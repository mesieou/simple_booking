import { createClient } from "../../database/supabase/server"; // Corrected relative path
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error'; // Assuming this path is still valid from this new location

// Defined based on our previous discussions
export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp?: string; // ISO date string, when the message was recorded
}

// Simplified representation of what we need from/for a chat session record in this service
interface ChatSessionRecord {
  id: string;
  allMessages: ChatMessage[];
  updatedAt: string; // ISO date string
  createdAt: string; // ISO date string
  // We might need other fields like endedAt for the active session logic
  endedAt?: string | null;
}

// Input for logging an interaction
export interface InteractionRecordInput {
  chat_session_id: string;
  userMessage?: string | null;
  botMessage?: string | null;
  customerIntent?: string | null;
  // We might add retrievedDataInfo, etc., later if needed by this service
  // For now, keeping it minimal based on immediate needs for intent detection context
}

const WHATSAPP_SESSION_TIMEOUT_HOURS = 24; // Default, can be overridden or configured

/**
 * Finds an active chat session for a given channel user or creates a new one.
 * An active session is one that has not explicitly ended and has had activity within the timeout period.
 * @param channel The communication channel (e.g., 'whatsapp').
 * @param channelUserId The user's identifier on that channel.
 * @param sessionTimeoutHours The duration in hours to consider a session active without new messages.
 * @returns The session ID and its current allMessages array.
 */
export async function findOrCreateActiveChatSession(
  channel: string,
  channelUserId: string,
  sessionTimeoutHours: number = WHATSAPP_SESSION_TIMEOUT_HOURS
): Promise<{ id: string; allMessages: ChatMessage[] }> {
  const supa = await createClient();
  const threshold = new Date(Date.now() - sessionTimeoutHours * 60 * 60 * 1000).toISOString();

  // 1. Try to find an existing active session
  const { data: existingSession, error: fetchError } = await supa
    .from('chatSessions')
    .select('id, allMessages, updatedAt, createdAt, endedAt') // Ensure all needed fields are selected
    .eq('channel', channel)
    .eq('channel_user_id', channelUserId)
    .is('endedAt', null)       // Session not explicitly ended
    .gte('updatedAt', threshold) // Session has recent activity
    .order('updatedAt', { ascending: false })
    .limit(1)
    .maybeSingle(); // Returns null if no row found, instead of error

  if (fetchError) {
    handleModelError(`Error fetching active session for ${channel}:${channelUserId}`, fetchError);
    // handleModelError usually throws, so this part might not be reached unless it's configured not to.
    // If it doesn't throw, we need a fallback.
    throw fetchError; // Ensure error propagation if handleModelError doesn't
  }

  if (existingSession) {
    console.log(`[ChatService] Found active session ${existingSession.id} for ${channel}:${channelUserId}`);
    return {
      id: existingSession.id,
      allMessages: (existingSession.allMessages as ChatMessage[] || []),
    };
  }

  // 2. If no active session, mark older sessions for this user as ended (optional but good practice)
  // This prevents multiple "lingering" active sessions if timeout logic changes or wasn't perfect.
  const { error: updateOldError } = await supa
    .from('chatSessions')
    .update({ endedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .eq('channel', channel)
    .eq('channel_user_id', channelUserId)
    .is('endedAt', null);

  if (updateOldError) {
    // Log this error but don't let it block new session creation
    console.warn(`[ChatService] Error marking old sessions as ended for ${channel}:${channelUserId}:`, updateOldError.message);
  }

  // 3. Create a new session
  console.log(`[ChatService] No active session found for ${channel}:${channelUserId}. Creating new one.`);
  const newSessionId = uuidv4();
  const now = new Date().toISOString();
  const newSessionData = {
    id: newSessionId,
    channel: channel,
    channel_user_id: channelUserId,
    starterAt: now,
    createdAt: now,
    updatedAt: now,
    allMessages: [], // Starts with empty messages
    endedAt: null,
  };

  const { data: createdSession, error: createError } = await supa
    .from('chatSessions')
    .insert(newSessionData)
    .select('id, allMessages') // Only select what we need to return
    .single();

  if (createError) {
    handleModelError(`Error creating new session for ${channel}:${channelUserId}`, createError);
    throw createError; // Ensure error propagation
  }

  if (!createdSession) {
    handleModelError('New session creation returned no data', new Error('No data from insert'));
    throw new Error('No data from insert'); // Ensure error propagation
  }
  
  console.log(`[ChatService] Created new session ${createdSession.id} for ${channel}:${channelUserId}`);
  return {
    id: createdSession.id,
    allMessages: [], // Freshly created, so empty messages array
  };
}

/**
 * Appends user and bot messages to a chat session's allMessages array and updates its timestamp.
 * @param sessionId The ID of the chat session to update.
 * @param currentAllMessages The current array of allMessages from the session.
 * @param userMessage The user's message object.
 * @param botMessage The bot's message object.
 */
export async function appendMessagesToChatSession(
  sessionId: string,
  currentAllMessages: ChatMessage[],
  userMessage: ChatMessage,
  botMessage: ChatMessage
): Promise<void> {
  const supa = await createClient();
  const now = new Date().toISOString();

  // Ensure timestamps are present if not already set by the caller
  const finalUserMessage = { ...userMessage, timestamp: userMessage.timestamp || now };
  const finalBotMessage = { ...botMessage, timestamp: botMessage.timestamp || now };

  const updatedAllMessages = [
    ...currentAllMessages,
    finalUserMessage,
    finalBotMessage,
  ];

  const { error } = await supa
    .from('chatSessions')
    .update({
      allMessages: updatedAllMessages,
      updatedAt: now,
    })
    .eq('id', sessionId);

  if (error) {
    handleModelError(`Error appending messages to session ${sessionId}`, error);
    // Depending on handleModelError, this might throw. If not, rethrow or handle.
    throw error;
  }
  console.log(`[ChatService] Appended messages to session ${sessionId}`);
}

/**
 * Logs an interaction to the interactions table.
 * @param interactionData The data for the interaction to log.
 * @returns The ID of the newly created interaction record.
 */
export async function logInteraction(
  interactionData: InteractionRecordInput
): Promise<{ id: string }> {
  const supa = await createClient();
  const newInteractionId = uuidv4();
  const now = new Date().toISOString();

  const dbData = {
    ...interactionData,
    id: newInteractionId,
    createdAt: now,
    // `updatedAt` is not typically on an immutable log like interactions, 
    // but if your table has it, add it here or ensure DB default.
  };

  const { data: createdInteraction, error } = await supa
    .from('interactions')
    .insert(dbData)
    .select('id') // Only select the ID back
    .single();

  if (error) {
    handleModelError(
      `Error logging interaction for session ${interactionData.chat_session_id}`,
      error
    );
    throw error;
  }

  if (!createdInteraction) {
    handleModelError(
      'Interaction logging returned no data',
      new Error('No data from insert for interaction')
    );
    throw new Error('No data from insert for interaction');
  }
  
  console.log(`[ChatService] Logged interaction ${createdInteraction.id} for session ${interactionData.chat_session_id}`);
  return { id: createdInteraction.id };
}

// --- Other functions (appendMessagesToChatSession, logInteraction) will go here --- 