import { Redis } from 'ioredis';
import { UserGoal, ChatContext, ChatConversationSession } from '@/lib/bot-engine/types';
import { UserContext } from '@/lib/database/models/user-context';

interface CachedSession {
  sessionId: string;
  context: ChatContext;
  userContext: UserContext;
  lastActivity: Date;
  version: number; // For optimistic locking
}

export class ScalableSessionManager {
  private static instance: ScalableSessionManager;
  private redis: Redis | null = null;
  private localCache = new Map<string, CachedSession>();
  private readonly SESSION_TTL = 2 * 60 * 60; // 2 hours
  private readonly CACHE_SIZE_LIMIT = 1000;

  private constructor() {
    // Initialize Redis if available (graceful degradation)
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL);
        console.log('[SessionManager] Redis cache initialized');
      } catch (error) {
        console.warn('[SessionManager] Redis unavailable, using local cache:', error);
      }
    }
  }

  static getInstance(): ScalableSessionManager {
    if (!ScalableSessionManager.instance) {
      ScalableSessionManager.instance = new ScalableSessionManager();
    }
    return ScalableSessionManager.instance;
  }

  /**
   * Gets or creates a session with proper caching and state management
   */
  async getSession(participantId: string, businessId: string): Promise<CachedSession> {
    const sessionKey = `session:${businessId}:${participantId}`;
    
    // Try cache first (Redis, then local)
    let cachedSession = await this.getCachedSession(sessionKey);
    
    if (cachedSession) {
      // Update last activity
      cachedSession.lastActivity = new Date();
      await this.setCachedSession(sessionKey, cachedSession);
      console.log(`[SessionManager] Retrieved cached session: ${sessionKey}`);
      return cachedSession;
    }

    // Load from database and cache
    cachedSession = await this.loadSessionFromDatabase(participantId, businessId);
    await this.setCachedSession(sessionKey, cachedSession);
    
    console.log(`[SessionManager] Created new session: ${sessionKey}`);
    return cachedSession;
  }

  /**
   * Updates session state with optimistic locking
   */
  async updateSession(
    sessionKey: string, 
    updater: (session: CachedSession) => CachedSession
  ): Promise<boolean> {
    const current = await this.getCachedSession(sessionKey);
    if (!current) {
      throw new Error(`Session not found: ${sessionKey}`);
    }

    const updated = updater(current);
    updated.version += 1;
    updated.lastActivity = new Date();

    // Optimistic locking - check version hasn't changed
    const stored = await this.getCachedSession(sessionKey);
    if (stored && stored.version !== current.version) {
      console.warn(`[SessionManager] Version conflict for ${sessionKey}, retrying...`);
      return false; // Caller should retry
    }

    await this.setCachedSession(sessionKey, updated);
    
    // Async persist to database (fire and forget for performance)
    this.persistToDatabase(updated).catch(error => {
      console.error(`[SessionManager] Database persistence failed for ${sessionKey}:`, error);
    });

    return true;
  }

  /**
   * Adds a goal to the session
   */
  async addGoal(sessionKey: string, goal: UserGoal): Promise<boolean> {
    return this.updateSession(sessionKey, (session) => {
      // Complete any existing goals of the same type
      session.context.currentConversationSession!.activeGoals = 
        session.context.currentConversationSession!.activeGoals.map(g => 
          g.goalType === goal.goalType ? { ...g, goalStatus: 'completed' as const } : g
        );
      
      // Add new goal
      session.context.currentConversationSession!.activeGoals.push(goal);
      
      console.log(`[SessionManager] Added ${goal.goalType} goal to session: ${sessionKey}`);
      return session;
    });
  }

  /**
   * Updates an existing goal
   */
  async updateGoal(sessionKey: string, goalUpdater: (goal: UserGoal) => UserGoal): Promise<boolean> {
    return this.updateSession(sessionKey, (session) => {
      const activeGoal = session.context.currentConversationSession!.activeGoals
        .find(g => g.goalStatus === 'inProgress');
      
      if (activeGoal) {
        const updatedGoal = goalUpdater(activeGoal);
        session.context.currentConversationSession!.activeGoals = 
          session.context.currentConversationSession!.activeGoals.map(g => 
            g === activeGoal ? updatedGoal : g
          );
        
        console.log(`[SessionManager] Updated ${activeGoal.goalType} goal in session: ${sessionKey}`);
      }
      
      return session;
    });
  }

  private async getCachedSession(key: string): Promise<CachedSession | null> {
    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        console.warn(`[SessionManager] Redis get failed for ${key}:`, error);
      }
    }

    // Fallback to local cache
    return this.localCache.get(key) || null;
  }

  private async setCachedSession(key: string, session: CachedSession): Promise<void> {
    // Set in Redis
    if (this.redis) {
      try {
        await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
      } catch (error) {
        console.warn(`[SessionManager] Redis set failed for ${key}:`, error);
      }
    }

    // Set in local cache with size limit
    if (this.localCache.size >= this.CACHE_SIZE_LIMIT) {
      const oldestKey = this.localCache.keys().next().value;
      this.localCache.delete(oldestKey);
    }
    this.localCache.set(key, session);
  }

  private async loadSessionFromDatabase(participantId: string, businessId: string): Promise<CachedSession> {
    // Import here to avoid circular dependencies
    const { getOrCreateChatContext } = await import('./session-manager');
    const { ConversationalParticipant } = await import('@/lib/bot-engine/types');
    
    const participant: ConversationalParticipant = {
      id: participantId,
      type: 'customer',
      associatedBusinessId: businessId,
      creationTimestamp: new Date(),
      lastUpdatedTimestamp: new Date(),
    };

    const { context, sessionId, userContext } = await getOrCreateChatContext(participant);
    
    return {
      sessionId,
      context,
      userContext,
      lastActivity: new Date(),
      version: 1,
    };
  }

  private async persistToDatabase(session: CachedSession): Promise<void> {
    try {
      const { persistSessionState } = await import('./state-persister');
      
      const activeGoal = session.context.currentConversationSession?.activeGoals
        .find(g => g.goalStatus === 'inProgress');
      
      await persistSessionState(
        session.sessionId,
        session.userContext,
        session.context.currentConversationSession!,
        activeGoal,
        '', // No specific user message for background persist
        '', // No bot response for background persist
        undefined,
        undefined
      );
    } catch (error) {
      console.error('[SessionManager] Database persistence error:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired sessions (call this periodically)
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, session] of this.localCache.entries()) {
      if (now - session.lastActivity.getTime() > this.SESSION_TTL * 1000) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.localCache.delete(key));
    console.log(`[SessionManager] Cleaned up ${expiredKeys.length} expired sessions`);
  }
}

// Singleton instance
export const sessionManager = ScalableSessionManager.getInstance();

// Start cleanup interval
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    sessionManager.cleanup().catch(console.error);
  }, 5 * 60 * 1000); // Every 5 minutes
} 