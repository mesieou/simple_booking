import { Notification } from "@/lib/database/models/notification";

// Define a consistent type for the state we manage
type EscalationStatus = 'none' | 'pending_human' | 'in_progress_human' | 'resolved_human';

/**
 * Escalation Manager
 * 
 * This module is the core of the human escalation system. It is designed
 * to be a self-contained "sidecar" that can be plugged into any conversation engine.
 * It manages the escalation state of a conversation and handles all related actions.
 */
export class EscalationManager {

    /**
     * Checks if a conversation is currently locked and waiting for human intervention.
     * This is the main "pause" switch for the bot.
     * 
     * @param status The current escalation status of the conversation.
     * @returns `true` if the bot should be paused, otherwise `false`.
     */
    public static isConversationLocked(status: EscalationStatus | undefined | null): boolean {
        return status === 'pending_human' || status === 'in_progress_human';
    }

    /**
     * Initiates the human escalation process.
     * This function should be called when `EscalationDetector.isEscalationRequired()` returns true.
     * 
     * @param businessId The ID of the business this escalation belongs to.
     * @param sessionId The ID of the current chat session.
     * @param channelUserId The user's identifier on the channel (e.g., phone number).
     * @param userMessage The message that triggered the escalation.
     * @returns A conversation output object with the "connecting you" message and updated state.
     */
    public static async initiateEscalation(
        businessId: string,
        sessionId: string, 
        channelUserId: string,
        userMessage: string
    ): Promise<{ response: string; updatedState: { escalationStatus: EscalationStatus, escalatedAt: string } }> {
        
        // 1. Create the notification for the admin panel
        await Notification.create({
            businessId: businessId,
            chatSessionId: sessionId,
            message: `User ${channelUserId} requires human assistance. Last message: "${userMessage}"`
        });
        console.log(`[EscalationManager] Notification created for session ${sessionId}`);

        // 2. Prepare the state update
        const updatedState = {
            escalationStatus: 'pending_human' as EscalationStatus,
            escalatedAt: new Date().toISOString()
        };

        // 3. Return the standard response and the state update
        return {
            response: "One moment, please. I'll connect you with a member of our team to help you.",
            updatedState
        };
    }

    /**
     * Returns the state update for resolving an escalation.
     * This would be called from an admin API route.
     * 
     * @returns The updated state object.
     */
    public static resolveEscalation(): { escalationStatus: EscalationStatus, resolvedAt: string } {
        return {
            escalationStatus: 'resolved_human' as EscalationStatus,
            resolvedAt: new Date().toISOString()
        };
    }
    
    /**
     * Creates a standardized "paused" response when a user messages during an escalation.
     * The bot should send no message in this case, but we need a valid output object.
     * 
     * @returns A conversation output object indicating the bot is paused.
     */
    public static createPausedResponse(): { response: string; buttons: [], shouldPersistContext: boolean } {
        return {
            response: '', // No message is sent to the user
            buttons: [],
            shouldPersistContext: true // We still want to save the user's message
        };
    }
} 