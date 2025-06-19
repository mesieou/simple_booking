'use server';

import { ChatSession, ChatMessage } from '@/lib/database/models/chat-session';
import { createClient } from '@/lib/database/supabase/server';
import { WhatsappSender } from '@/lib/conversation-engine/whatsapp/whatsapp-message-sender';
import { revalidatePath } from 'next/cache';
import { 
    takeControl as takeControlAction, 
    sendMessage as sendMessageAction, 
    resolve as resolveAction 
} from '@/lib/admin/actions';

/**
 * Represents a consolidated conversation with a single user,
 * combining all their historical chat sessions.
 */
export interface Conversation {
  id: string; // Corresponds to channelUserId
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  timestamp: string;
  hasEscalation: boolean;
  unreadCount: number;
  messages: ChatMessage[];
}

/**
 * Fetches all chat sessions for a given business, then groups and
 * consolidates them into a list of conversations per user.
 *
 * @param businessId The UUID of the business.
 * @returns A promise that resolves to an array of Conversation objects.
 */
export async function getConversations(businessId: string): Promise<Conversation[]> {
    const supa = createClient();

    // In a real scenario, you'd get the businessId from the authenticated user's session
    // For now, we are using the hardcoded one as requested.
    // const hardcodedBusinessId = '228c7e8e-ec15-4eeb-a766-d1ebee07104f';

    const { data: sessions, error } = await supa
        .from('chatSessions')
        .select('*')
        .eq('businessId', businessId)
        .order('createdAt', { ascending: true });

    if (error) {
        console.error('Error fetching chat sessions:', error);
        return [];
    }

    if (!sessions) {
        return [];
    }

    const conversationsMap = new Map<string, ChatMessage[]>();
    for (const session of sessions) {
        const userId = session.channelUserId;
        const userMessages = conversationsMap.get(userId) || [];
        conversationsMap.set(userId, [...userMessages, ...session.allMessages]);
    }

    const formattedConversations: Conversation[] = Array.from(conversationsMap.entries()).map(([userId, messages]) => {
        messages.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());

        const lastMessage = messages[messages.length - 1];
        
        let customerName = `User ${userId.slice(-4)}`;
        const botMessageWithName = messages.find(m => m.role === 'bot' && m.content.includes('Your name is'));
        if (botMessageWithName) {
            const match = botMessageWithName.content.match(/Your name is (.*?)(!|\.|,)/);
            if (match && match[1]) {
                customerName = match[1].trim();
            }
        }

        return {
            id: userId,
            customerName,
            customerPhone: userId,
            lastMessage: lastMessage?.content || 'No messages yet',
            timestamp: lastMessage?.timestamp ? new Date(lastMessage.timestamp).toISOString() : new Date().toISOString(),
            hasEscalation: false, // Placeholder for future logic
            unreadCount: 0, // Placeholder for future logic
            messages,
        };
    });

    formattedConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return formattedConversations;
}

/**
 * Fetches all chat sessions for a given business ID by calling the model method.
 */
export async function getChatSessions(businessId: string) {
    const sessions = await ChatSession.getByBusinessId(businessId);
    return sessions.map(session => session.getData());
}

/**
 * Fetches the details of a single chat session by calling the model method.
 */
export async function getChatSessionDetails(sessionId: string) {
    const session = await ChatSession.getById(sessionId);
    return session ? session.getData() : null;
}

/**
 * Fetches the user context for a given channel user ID.
 */
export async function getUserContext(channelUserId: string) {
    const { UserContext } = await import('@/lib/database/models/user-context');
    const userContext = await UserContext.getByChannelUserId(channelUserId);
    return userContext ? userContext.getData() : null;
}

/**
 * Sends a message from a human agent to a user and persists it in the database.
 *
 * @param channelUserId The user's identifier on the channel (e.g., phone number).
 * @param messageText The text content of the message to send.
 * @returns An object indicating success or failure.
 */
export async function sendHumanMessage(channelUserId: string, messageText: string) {
    const SESSION_TIMEOUT_HOURS = 12;

    const activeSession = await ChatSession.getActiveByChannelUserId('whatsapp', channelUserId, SESSION_TIMEOUT_HOURS);

    if (!activeSession) {
        console.error(`No active session for user ${channelUserId}. Message not sent.`);
        return { success: false, error: 'No active session found.' };
    }

    const humanMessage: ChatMessage = {
        role: 'human',
        content: messageText,
        timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...activeSession.allMessages, humanMessage];

    await ChatSession.update(activeSession.id, { allMessages: updatedMessages });

    try {
        const whatsappSender = new WhatsappSender();
        await whatsappSender.sendMessage(channelUserId, { text: messageText });
    } catch (error) {
        console.error('Failed to send WhatsApp message:', error);
        return { success: false, error: 'Failed to send WhatsApp message.' };
    }

    revalidatePath('/admin-panel');
    return { success: true };
}

/**
 * Takes control of an escalated chat.
 * This is now a wrapper around the centralized admin action.
 */
export async function takeControlOfChat(sessionId: string) {
  'use server';
  return await takeControlAction(sessionId);
}

/**
 * Sends a message from an admin to a user.
 * This is now a wrapper around the centralized admin action.
 */
export async function sendAdminMessage(sessionId: string, message: string, adminId: string) {
  'use server';
  const session = await ChatSession.getById(sessionId);
  if (!session) return { success: false, error: 'Session not found' };
  return await sendMessageAction(sessionId, message, adminId);
}

/**
 * Resolves an escalated chat, returning control to the bot.
 * This is now a wrapper around the centralized admin action.
 */
export async function resolveChat(sessionId: string) {
  'use server';
  return await resolveAction(sessionId);
} 