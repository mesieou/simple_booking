'use server';

import { UserContext } from "@/lib/database/models/user-context";
import { ChatSession } from "@/lib/database/models/chat-session";
import { DialogueState } from "@/lib/conversation-engine/v2/nlu/types";
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { EscalationManager } from "@/lib/escalation-system/manager";
import { revalidatePath } from "next/cache";

/**
 * Marks a conversation as being handled by a human.
 */
export async function takeControl(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!sessionId) throw new Error("Session ID is required");

        const session = await ChatSession.getById(sessionId);
        if (!session) throw new Error("Chat session not found");

        const userContext = await UserContext.getByChannelUserId(session.channelUserId);
        if (!userContext || !userContext.currentGoal) throw new Error("Conversation context not found");

        const dialogueState = userContext.currentGoal.collectedData.dialogueState as DialogueState;
        dialogueState.escalationStatus = 'in_progress_human';
        dialogueState.lastActivityAt = new Date().toISOString();

        await UserContext.updateByChannelUserId(userContext.channelUserId, { currentGoal: userContext.currentGoal });
        
        console.log(`[AdminActions] Admin has taken control of session ${sessionId}`);
        revalidatePath('/admin-panel');
        return { success: true };
    } catch (error) {
        console.error("[AdminActions] Error in takeControl:", error);
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Sends a message from an admin to a user.
 */
export async function sendMessage(sessionId: string, message: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!sessionId || !message) throw new Error("Session ID and message are required");
        
        const session = await ChatSession.getById(sessionId);
        if (!session) throw new Error("Chat session not found");

        const newHistory = [...session.allMessages, {
            role: 'bot' as const,
            content: `[Admin: ${adminId || 'Staff'}] ${message}`,
            timestamp: new Date().toISOString()
        }];
        await ChatSession.update(sessionId, { allMessages: newHistory });
        
        const whatsappSender = new WhatsappSender();
        await whatsappSender.sendMessage(session.channelUserId, { text: message });

        console.log(`[AdminActions] Admin message sent to user ${session.channelUserId}`);
        return { success: true };
    } catch (error) {
        console.error("[AdminActions] Error in sendMessage:", error);
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Resolves an escalation and returns control to the bot.
 */
export async function resolve(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!sessionId) throw new Error("Session ID is required");
        
        const session = await ChatSession.getById(sessionId);
        if (!session) throw new Error("Chat session not found");

        const userContext = await UserContext.getByChannelUserId(session.channelUserId);
        if (!userContext || !userContext.currentGoal) throw new Error("Conversation context not found");

        const dialogueState = userContext.currentGoal.collectedData.dialogueState as DialogueState;
        const resolvedState = EscalationManager.resolveEscalation();
        
        const updatedDialogueState = { ...dialogueState, ...resolvedState };
        userContext.currentGoal.collectedData.dialogueState = updatedDialogueState;

        await UserContext.updateByChannelUserId(userContext.channelUserId, { currentGoal: userContext.currentGoal });

        console.log(`[AdminActions] Admin has resolved session ${sessionId}`);
        revalidatePath('/admin-panel');
        return { success: true };
    } catch (error) {
        console.error("[AdminActions] Error in resolve:", error);
        return { success: false, error: (error as Error).message };
    }
} 