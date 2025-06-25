import { createClient } from "../supabase/server";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';
import { getServiceRoleClient } from "../supabase/service-role";

// Corresponds to the structure of the JSONB objects in the userContexts table.
// These are based on Juan's original bot-manager types.
export interface UserGoal {
  goalType: string;
  goalAction?: string;
  goalStatus: 'inProgress' | 'completed' | 'failed' | 'paused';
  currentStepIndex: number;
  collectedData: Record<string, any>;
  flowKey: string;
}

export interface ParticipantPreferences {
  language: string;
  timezone: string;
  notificationSettings: Record<string, boolean>;
}

// Interface for the user_contexts table schema, using camelCase for consistency.
export interface UserContextDBSchema {
  id: string;                      // Not Null
  createdAt: string;                 // Not Null
  updatedAt: string;                 // Not Null
  channelUserId: string;             // Not Null
  businessId?: string | null;        // Nullable
  currentGoal?: UserGoal | null;     // Nullable
  previousGoal?: UserGoal | null;    // Nullable
  participantPreferences?: ParticipantPreferences | null; // Nullable
  frequentlyDiscussedTopics?: string | null; // Nullable (stored as comma-separated text)
}

// Type for creating a new context record. channelUserId is the only required field.
export type UserContextCreateInput = Pick<UserContextDBSchema, 'channelUserId'> & Partial<Omit<UserContextDBSchema, 'id' | 'createdAt' | 'updatedAt' | 'channelUserId'>>;

// Type for updating an existing context record. All fields are optional.
export type UserContextUpdateInput = Partial<Omit<UserContextDBSchema, 'id' | 'createdAt' | 'channelUserId'>>;

/**
 * Manages data persistence for the userContexts table in Supabase.
 * This class handles all CRUD operations and acts as the data layer for conversation context.
 */
export class UserContext {
  id: string;
  createdAt: string;
  updatedAt: string;
  channelUserId: string;
  businessId: string | null;
  currentGoal: UserGoal | null;
  previousGoal: UserGoal | null;
  participantPreferences: ParticipantPreferences | null;
  frequentlyDiscussedTopics: string | null;

  private constructor(data: UserContextDBSchema) {
    this.id = data.id;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.channelUserId = data.channelUserId;
    this.businessId = data.businessId ?? null;
    this.currentGoal = data.currentGoal ?? null;
    this.previousGoal = data.previousGoal ?? null;
    this.participantPreferences = data.participantPreferences ?? null;
    this.frequentlyDiscussedTopics = data.frequentlyDiscussedTopics ?? null;
  }

  private static isValidUUID(id: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Creates a new user context record in the database.
   * This is typically called on a user's first interaction.
   */
  static async create(input: UserContextCreateInput): Promise<UserContext> {
    const supa = getServiceRoleClient();
    const now = new Date().toISOString();

    const newId = uuidv4();

    const dbData: UserContextDBSchema = {
      id: newId,
      channelUserId: input.channelUserId,
      businessId: input.businessId,
      currentGoal: input.currentGoal,
      previousGoal: input.previousGoal,
      participantPreferences: input.participantPreferences,
      frequentlyDiscussedTopics: input.frequentlyDiscussedTopics,
      createdAt: now,
      updatedAt: now,
    };

    const { data, error } = await supa
      .from('userContexts')
      .insert(dbData)
      .select('*')
      .single();

    if (error) {
      handleModelError('Failed to create user context', error);
    }
    return new UserContext(data as UserContextDBSchema);
  }

  /**
   * Retrieves a user context by their unique channel identifier (e.g., WhatsApp number).
   * This is the primary method for fetching context during a conversation.
   */
  static async getByChannelUserId(channelUserId: string): Promise<UserContext | null> {
    if (!channelUserId) {
      console.warn('[UserContextModel] channelUserId is required for getByChannelUserId');
      return null;
    }
    const supa = getServiceRoleClient();
    const { data, error } = await supa
      .from('userContexts')
      .select('*')
      .eq('channelUserId', channelUserId)
      .maybeSingle();

    if (error) {
      handleModelError(`Failed to fetch user context for channelUserId ${channelUserId}`, error);
    }
    return data ? new UserContext(data as UserContextDBSchema) : null;
  }

  /**
   * Updates an existing user context record based on its unique channel identifier.
   * This will be called after every turn to persist the new state.
   */
  static async updateByChannelUserId(channelUserId: string, input: UserContextUpdateInput): Promise<UserContext | null> {
    if (!channelUserId) {
      console.warn('[UserContextModel] channelUserId is required for updateByChannelUserId');
      return null;
    }
    const supa = getServiceRoleClient();
    const dataToUpdate: UserContextUpdateInput & { updatedAt: string } = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    // Remove channelUserId from the update payload as it should not be changed.
    delete (dataToUpdate as Partial<UserContextDBSchema>).channelUserId;

    const { data, error } = await supa
      .from('userContexts')
      .update(dataToUpdate)
      .eq('channelUserId', channelUserId)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found, which is a possible outcome.
      handleModelError(`Failed to update user context for channelUserId ${channelUserId}`, error);
    }
    if (!data) {
        console.warn(`[UserContextModel] Update for user context ${channelUserId} returned no data, record might not exist.`);
        return null;
    }
    return new UserContext(data as UserContextDBSchema);
  }

  /**
   * Deletes a user context record by its primary key (ID).
   */
  static async delete(id: string): Promise<void> {
    if (!this.isValidUUID(id)) {
      handleModelError('Invalid UUID for delete UserContext', new Error('Invalid UUID for delete'));
      return;
    }
    const supa = getServiceRoleClient();
    const { error } = await supa.from('userContexts').delete().eq('id', id);

    if (error) {
      handleModelError(`Failed to delete user context ${id}`, error);
    }
  }

  // --- Helper Methods ---

  /**
   * A type guard to check if a UserGoal object is valid.
   */
  static isUserGoal(goal: any): goal is UserGoal {
    return (
      goal &&
      typeof goal.goalType === 'string' &&
      typeof goal.goalStatus === 'string' &&
      typeof goal.currentStepIndex === 'number' &&
      typeof goal.collectedData === 'object' &&
      typeof goal.flowKey === 'string'
    );
  }
} 