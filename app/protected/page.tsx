import { createClient } from "../../lib/database/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "./components/chat-interface";
import { Conversation } from "./components/chat-interface";

// This is a simple placeholder type.
type ChatSession = {
  id: string;
};

export const dynamic = 'force-dynamic';

export default async function ProtectedPage() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Securely fetch chat sessions.
  // RLS ensures we only get the chats for the logged-in user's business.
  const { data: chatSessions, error } = await supabase
    .from("chatSessions")
    .select("id, channelUserId, updatedAt") 
    .order("updatedAt", { ascending: false });

  if (error) {
    console.error("Error fetching chat sessions:", error);
    return <p className="p-4 text-red-500">Error loading chats.</p>;
  }
  
  // This is the list of active chats for the user
  const conversationsMap = new Map<string, Conversation>();
  if (chatSessions) {
    for (const session of chatSessions) {
        if (!conversationsMap.has(session.channelUserId)) {
            conversationsMap.set(session.channelUserId, {
                channelUserId: session.channelUserId,
                updatedAt: session.updatedAt,
            });
        }
    }
  }

  const initialConversations = Array.from(conversationsMap.values());

  return (
    <div className="w-full max-w-7xl mx-auto p-4 flex flex-col">
      <h1 className="text-2xl font-bold mb-4 text-white">Your Conversations</h1>
      {/* This container gives the chat component a fixed height relative to the viewport */}
      <div className="h-[70vh]">
        <ChatInterface initialConversations={initialConversations} />
      </div>
    </div>
  );
}
