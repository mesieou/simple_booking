"use server";

import { createClient } from "@/lib/database/supabase/server";
import { redirect } from "next/navigation";

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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
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
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/protected/reset-password`,
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

// Define the shape of a chat message that the UI components expect
export type ChatMessage = {
  id: string; // For React key
  content: string;
  createdAt: string;
  senderRole: 'customer' | 'agent' | 'bot' | 'staff';
};

// This represents the shape of a message as it's stored in the DB's JSONB column
type StoredChatMessage = {
  role: 'user' | 'bot' | 'agent' | 'staff';
  content: string;
  timestamp?: string;
}

/**
 * @deprecated Use getMessagesForUser instead. This function fetches messages from a single session only.
 */
// TODO: move this to model
export async function getMessagesForSession(sessionId: string): Promise<ChatMessage[]> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  // RLS is handled on the chatSessions table, so this query is secure.
  const { data, error } = await supabase
    .from("chatSessions")
    .select("allMessages")
    .eq("id", sessionId)
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

  // Cast the fetched messages to our stored type
  const storedMessages = data.allMessages as StoredChatMessage[];

  // Transform the stored messages into the format the UI component expects
  return storedMessages.map((msg, index) => ({
    id: `${sessionId}-${index}`, // Create a stable key for React
    content: msg.content,
    createdAt: msg.timestamp || new Date().toISOString(), // Provide a fallback for the timestamp
    // Map the 'role' from the DB to the 'senderRole' the UI expects
    senderRole: msg.role === 'user' ? 'customer' : msg.role as 'agent' | 'bot' | 'staff', 
  }));
}

// TODO: move this to model
export async function getMessagesForUser(channelUserId: string): Promise<ChatMessage[]> {
    const supabase = createClient();

    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
      throw new Error("Not authenticated");
    }

    // RLS on chatSessions table ensures we only get sessions for the user's business.
    const { data: sessions, error } = await supabase
        .from("chatSessions")
        .select("allMessages, createdAt")
        .eq("channelUserId", channelUserId)
        .order("createdAt", { ascending: true });
    
    if (error) {
        console.error("Error fetching sessions for user:", error);
        throw new Error("Failed to fetch conversations for user.");
    }

    if (!sessions) {
        return [];
    }

    // Flatten all message arrays from all sessions into one array
    const allMessages: StoredChatMessage[] = sessions.flatMap(s => s.allMessages || []);

    // Sort the combined messages by timestamp to ensure chronological order
    allMessages.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return dateA - dateB;
    });

    // Transform the stored messages into the format the UI component expects
    return allMessages.map((msg, index) => ({
        id: `msg-${channelUserId}-${index}`, // Create a stable key
        content: msg.content,
        createdAt: msg.timestamp || new Date().toISOString(),
        senderRole: msg.role === 'user' ? 'customer' : msg.role as 'agent' | 'bot' | 'staff',
    }));
}

// TODO: move this to model
export async function getUserBusinessId(): Promise<string | null> {
    const supabase = createClient();

    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
        return null;
    }

    const { data: userData, error } = await supabase
        .from("users")
        .select("businessId")
        .eq("id", authData.session.user.id)
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
    
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
        return [];
    }

    // Import ChatSession here to avoid circular dependencies
    const { ChatSession } = await import("@/lib/database/models/chat-session");
    
    const conversationData = await ChatSession.getBusinessConversationsData(authData.session.user.id);
    
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
    
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
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

// TODO: move this to model
export async function markNotificationAsRead(notificationId: string): Promise<void> {
    const supabase = createClient();
    
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
        throw new Error("Not authenticated");
    }

    // For now, we'll just store this in localStorage since we don't have notification_reads table yet
    // This is a temporary solution until we implement the database table
    console.log(`[Actions] Marking notification ${notificationId} as read for user ${authData.session.user.id}`);
} 