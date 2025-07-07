/**
 * Centralized logging utility for bot-engine with journey tracking
 * Provides structured, consistent logging across all components
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FLOW' | 'JOURNEY';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  goalType?: string;
  step?: string;
  messageId?: string;
  businessId?: string;
  source?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: LogContext;
  data?: any;
  duration?: number;
}

class BotLogger {
  private journeySteps: Map<string, Array<{ step: string; timestamp: Date; component: string }>> = new Map();
  private performanceTimers: Map<string, Date> = new Map();

  /**
   * Creates a scoped logger for a specific component
   */
  createLogger(component: string) {
    return {
      // Journey tracking - high-level flow steps
      journey: (message: string, context?: LogContext, data?: any) => 
        this.log('JOURNEY', component, message, context, data),

      // Flow control - step transitions and decisions  
      flow: (message: string, context?: LogContext, data?: any) => 
        this.log('FLOW', component, message, context, data),

      // General information
      info: (message: string, context?: LogContext, data?: any) => 
        this.log('INFO', component, message, context, data),

      // Debug details (development only)
      debug: (message: string, context?: LogContext, data?: any) => 
        this.log('DEBUG', component, message, context, data),

      // Warnings
      warn: (message: string, context?: LogContext, data?: any) => 
        this.log('WARN', component, message, context, data),

      // Errors
      error: (message: string, context?: LogContext, data?: any) => 
        this.log('ERROR', component, message, context, data),

      // Performance tracking
      startTimer: (operation: string, context?: LogContext) => 
        this.startTimer(`${component}:${operation}`, context),

      endTimer: (operation: string, context?: LogContext, data?: any) => 
        this.endTimer(`${component}:${operation}`, context, data),

      // Journey step tracking
      trackStep: (step: string, context?: LogContext) => 
        this.trackJourneyStep(component, step, context),

      // Journey summary
      getJourney: (sessionId: string) => 
        this.getJourneySteps(sessionId)
    };
  }

  private log(level: LogLevel, component: string, message: string, context?: LogContext, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      context,
      data
    };

    // Format the log output based on level
    const formatted = this.formatLogEntry(entry);
    
    // Choose console method based on level
    switch (level) {
      case 'ERROR':
        console.error(formatted);
        break;
      case 'WARN':
        console.warn(formatted);
        break;
      case 'DEBUG':
        // Only show DEBUG in development
        if (process.env.NODE_ENV === 'development') {
          console.debug(formatted);
        }
        break;
      case 'JOURNEY':
        // Journey logs are always visible with special formatting
        console.log(`🚀 ${formatted}`);
        break;
      case 'FLOW':
        // Flow logs use arrow indicators
        console.log(`→ ${formatted}`);
        break;
      default:
        console.log(formatted);
    }

    // Track journey steps
    if (level === 'JOURNEY' && context?.sessionId) {
      this.trackJourneyStep(component, message, context);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, component, message, context, data, duration } = entry;
    
    // Base format
    let formatted = `[${component}] ${message}`;

    // Add context information
    if (context) {
      const contextParts: string[] = [];
      
      if (context.userId) contextParts.push(`user:${context.userId.slice(0, 8)}`);
      if (context.sessionId) contextParts.push(`session:${context.sessionId.slice(0, 8)}`);
      if (context.goalType) contextParts.push(`goal:${context.goalType}`);
      if (context.step) contextParts.push(`step:${context.step}`);
      if (context.source) contextParts.push(`src:${context.source}`);
      
      if (contextParts.length > 0) {
        formatted += ` (${contextParts.join(', ')})`;
      }
    }

    // Add duration if available
    if (duration !== undefined) {
      formatted += ` [${duration}ms]`;
    }

    // Add data if available (only for debug/error levels)
    if (data && (entry.level === 'DEBUG' || entry.level === 'ERROR')) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
      formatted += ` | Data: ${dataStr}`;
    }

    return formatted;
  }

  private startTimer(key: string, context?: LogContext): void {
    this.performanceTimers.set(key, new Date());
  }

  private endTimer(key: string, context?: LogContext, data?: any): number {
    const startTime = this.performanceTimers.get(key);
    if (!startTime) {
      console.warn(`[Logger] Timer not found for key: ${key}`);
      return 0;
    }

    const duration = Date.now() - startTime.getTime();
    this.performanceTimers.delete(key);

    // Log the performance result
    const [component, operation] = key.split(':');
    this.log('INFO', component, `${operation} completed`, context, { ...data, duration });

    return duration;
  }

  private trackJourneyStep(component: string, step: string, context?: LogContext): void {
    if (!context?.sessionId) return;

    if (!this.journeySteps.has(context.sessionId)) {
      this.journeySteps.set(context.sessionId, []);
    }

    const steps = this.journeySteps.get(context.sessionId)!;
    steps.push({
      step,
      timestamp: new Date(),
      component
    });

    // Keep only last 50 steps per session to prevent memory leaks
    if (steps.length > 50) {
      steps.splice(0, steps.length - 50);
    }
  }

  private getJourneySteps(sessionId: string): Array<{ step: string; timestamp: Date; component: string }> {
    return this.journeySteps.get(sessionId) || [];
  }

  /**
   * Prints a complete journey summary for debugging
   */
  printJourneySummary(sessionId: string): void {
    const steps = this.getJourneySteps(sessionId);
    if (steps.length === 0) {
      console.log(`[Journey] No steps recorded for session: ${sessionId.slice(0, 8)}`);
      return;
    }

    console.log(`\n🗺️  Journey Summary for session: ${sessionId.slice(0, 8)}`);
    console.log('================================================');
    
    steps.forEach((step, index) => {
      const timeStr = step.timestamp.toISOString().split('T')[1].split('.')[0];
      console.log(`${index + 1}. [${timeStr}] ${step.component} → ${step.step}`);
    });
    
    console.log('================================================\n');
  }
}

// Create singleton instance
const logger = new BotLogger();

// Export logger creators for different components
export const createLogger = (component: string) => logger.createLogger(component);

// Export journey utilities
export const printJourney = (sessionId: string) => logger.printJourneySummary(sessionId);

// Convenience exports for common components
export const MessageProcessorLogger = createLogger('MessageProcessor');
export const FlowControllerLogger = createLogger('FlowController');
export const GoalManagerLogger = createLogger('GoalManager');
export const LLMServiceLogger = createLogger('LLMService');
export const SessionManagerLogger = createLogger('SessionManager');
export const StatePersisterLogger = createLogger('StatePersister');
export const WhatsAppHandlerLogger = createLogger('WhatsAppHandler');
export const EscalationLogger = createLogger('EscalationHandler');
export const AudioHandlerLogger = createLogger('AudioHandler');
export const LanguageServiceLogger = createLogger('LanguageService'); 