"use server";

import { createClient, getServiceRoleClient } from "@/lib/database/supabase/server";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";
import { redirect } from "next/navigation";
import { type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { ChatSession } from "@/lib/database/models/chat-session";

export async function signUpAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://skedy.io'}/auth/callback`,
    },
  });

  if (error) {
    console.error("Sign up error:", error);
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Failed to create user");
  }

  redirect("/sign-in?message=Check your email to confirm your account");
}

export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Sign in error:", error);
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Failed to sign in");
  }

  redirect("/protected");
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formData.get("email") as string;
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://skedy.io'}/protected/reset-password`,
  });

  if (error) {
    console.error("Password reset error:", error);
    throw new Error(error.message);
  }

  redirect("/forgot-password?message=Check your email to reset your password");
}

export async function resetPasswordAction(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    console.error("Password update error:", error);
    throw new Error(error.message);
  }

  redirect("/sign-in?message=Password updated successfully");
}

// Represents the interactive message format from the bot for the frontend
export interface BotResponseMessage {
  text?: string;
  buttons?: Array<{ 
    buttonText: string;
    buttonValue: string;
    buttonDescription?: string;
  }>;
  listActionText?: string;
  listSectionTitle?: string;
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'bot' | 'staff';
  senderRole: 'customer' | 'bot' | 'staff';
  content: string | BotResponseMessage;
  timestamp?: string;
  createdAt: string;
  displayType?: 'text' | 'interactive';
  attachments?: Array<{
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
    url: string;
    caption?: string;
    originalFilename?: string;
    mimeType?: string;
    size?: number;
  }>;
};

// This type represents the structure as it's stored in Supabase JSONB
type StoredChatMessage = {
  role: 'user' | 'bot' | 'staff';
  content: string | BotResponseMessage; // Matches the DB schema
  timestamp?: string;
  displayType?: 'text' | 'interactive';
  attachments?: any; // Keep as 'any' for flexibility with DB a
};

/**
 * @deprecated Use getMessagesForUser instead. This function fetches messages from a single session only.
 */
// TODO: move this to model
export async function getMessagesForSession(sessionId: string): Promise<ChatMessage[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Get user's business ID for security validation
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("businessId")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.businessId) {
    console.error("Error fetching user's businessId:", userError);
    throw new Error("Could not identify your business");
  }

  // Use service role client for consistent behavior
  const serviceSupabase = getServiceRoleClient();

  // Fetch session with business validation for security
  const { data, error } = await serviceSupabase
    .from("chatSessions")
    .select("allMessages, businessId")
    .eq("id", sessionId)
    .eq("businessId", userData.businessId) // Security: only sessions from user's business
    .single();

  if (error) {
    console.error("Error fetching session:", error);
    // If no row is found, it's not a fatal error, just an empty session.
    if (error.code === 'PGRST116') {
        return [];
    }
    throw new Error("Failed to fetch messages.");
  }

  if (!data || !data.allMessages) {
    return [];
  }

  // The 'allMessages' field is of type jsonb and contains an array of StoredChatMessage
  const storedMessages = data.allMessages as StoredChatMessage[];

  if (!storedMessages) {
    return [];
  }

  // No need for complex mapping if frontend ChatMessage matches StoredChatMessage
  return storedMessages.map((msg: StoredChatMessage, index) => ({
    ...msg,
    id: `${sessionId}-${index}`, // Add a stable key for React
    content: msg.content,
    createdAt: msg.timestamp || new Date().toISOString(),
    senderRole: msg.role === 'user' ? 'customer' : msg.role, // Map back to senderRole
    timestamp: msg.timestamp,
    displayType: msg.displayType,
    attachments: msg.attachments,
  }));
}

// TODO: move this to model
export async function getMessagesForUser(channelUserId: string): Promise<ChatMessage[]> {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get user's business ID first for security validation
    const { data: userData, error: userError } = await supabase
        .from("users")
        .select("businessId")
        .eq("id", user.id)
        .single();

    if (userError || !userData?.businessId) {
        console.error("Error fetching user's businessId:", userError);
        throw new Error("Could not identify your business");
    }

    // Import service role client for consistent behavior with conversations
    const serviceSupabase = getServiceRoleClient();

    // Fetch sessions with business validation for security
    const { data: sessions, error } = await serviceSupabase
        .from("chatSessions")
        .select("allMessages, createdAt, businessId")
        .eq("channelUserId", channelUserId)
        .eq("businessId", userData.businessId) // Security: only sessions from user's business
        .order("createdAt", { ascending: true });
    
    if (error) {
        console.error("Error fetching sessions for user:", error);
        throw new Error("Failed to fetch conversations for user.");
    }

    if (!sessions) {
        return [];
    }

    // The 'allMessages' in each session is of type jsonb
    const allMessages: StoredChatMessage[] = sessions.flatMap(s => s.allMessages || []);

    if (!allMessages) {
        return [];
    }

    // Re-add sorting to ensure chronological order
    allMessages.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0).getTime();
      const dateB = new Date(b.timestamp || 0).getTime();
      return dateA - dateB;
    });

    // No need for complex mapping if frontend ChatMessage matches StoredChatMessage
    return allMessages.map((msg: StoredChatMessage, index) => ({
        ...msg,
        id: `msg-${channelUserId}-${index}`, // Add a stable key for React
        content: msg.content,
        createdAt: msg.timestamp || new Date().toISOString(),
        senderRole: msg.role === 'user' ? 'customer' : msg.role, // Map back to senderRole
        timestamp: msg.timestamp,
        displayType: msg.displayType,
        attachments: msg.attachments,
    }));
}

// TODO: move this to model
export async function getUserBusinessId(): Promise<string | null> {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return null;
    }

    const { data: userData, error } = await supabase
        .from("users")
        .select("businessId")
        .eq("id", user.id)
        .single();

    if (error || !userData?.businessId) {
        console.error("Error fetching user's businessId:", error);
        return null;
    }

    return userData.businessId;
}

export async function getBusinessConversations(): Promise<Array<{ 
  channelUserId: string; 
  updatedAt: string; 
  hasEscalation: boolean;
  escalationStatus: string | null;
  sessionId: string;
}>> {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return [];
    }

    // Import ChatSession here to avoid circular dependencies
    const { ChatSession } = await import("@/lib/database/models/chat-session");
    
    const conversationData = await ChatSession.getBusinessConversationsData(user.id);
    
    if (!conversationData) {
        return [];
    }

    return conversationData.conversations;
}

// TODO: move this to model
export async function getDashboardNotifications(): Promise<Array<{
  id: string;
  createdAt: string;
  message: string;
  status: string;
  chatSessionId: string;
  channelUserId: string;
}>> {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return [];
    }

    const businessId = await getUserBusinessId();
    if (!businessId) {
        return [];
    }

    // Import Notification here to avoid circular dependencies
    const { Notification } = await import("@/lib/database/models/notification");
    
    const notifications = await Notification.getDashboardNotificationsSimple(businessId);
    
    return notifications;
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[Actions] Attempted to mark notification as read without a user.");
    return;
  }

  // This is a temporary solution until we implement the database table
  console.log(`[Actions] Marking notification ${notificationId} as read for user ${user.id}`);
}

export async function getBusinessConversationsData(userId: string, preselectedSessionId?: string) {
  // ... existing code ...
}

export async function getChannelUserIdBySessionId(sessionId: string): Promise<string | null> {
  const businessId = await getUserBusinessId();
  if (!businessId) {
    console.error(`[Actions] Could not determine businessId for current user.`);
    return null;
  }
  
  try {
    const channelUserId = await ChatSession.getChannelUserIdBySessionId(sessionId, businessId);
    return channelUserId;
  } catch (error) {
    console.error(`[Actions] Error fetching channelUserId for session ${sessionId}:`, error);
    return null;
  }
}

export async function finishAssistance(sessionId: string) {
  const supa = createClient();

  const { error } = await supa.functions.invoke('finish-assistance', {
    body: { sessionId },
  });

  if (error) {
    console.error('Error finishing assistance:', error);
    throw new Error('Could not finish assistance');
  }

  console.log(`[Actions] Assistance finished for session ${sessionId}`);
  redirect('/protected');
}

export async function takeControl(sessionId: string) {
  const supa = createClient();

  const { error } = await supa.functions.invoke('take-control', {
    body: { sessionId },
  });

  if (error) {
    console.error('Error taking control:', error);
    throw new Error('Could not take control');
  }

  console.log(`[Actions] Took control of session ${sessionId}`);
  redirect('/protected');
}

export async function sendStaffReply(sessionId: string, message: string) {
  const supa = createClient();

  const { error } = await supa.functions.invoke('staff-reply', {
    body: { sessionId, message },
  });

  if (error) {
    console.error('Error sending staff reply:', error);
    throw new Error('Could not send reply');
  }

  console.log(`[Actions] Staff reply sent for session ${sessionId}`);
} 