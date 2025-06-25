import { createClient } from "../../lib/database/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "./components/chat-interface";
import { Conversation } from "./components/chat-interface";
import { ChatSession } from "../../lib/database/models/chat-session";

export const dynamic = 'force-dynamic';

export default async function ProtectedPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Get sessionId from URL parameters
  const resolvedSearchParams = await searchParams;
  const sessionIdFromUrl = resolvedSearchParams?.sessionId as string | undefined;

  // Use centralized method to get all conversation data
  const conversationData = await ChatSession.getBusinessConversationsData(
    session.user.id,
    sessionIdFromUrl
  );

  if (!conversationData) {
    return <p className="p-4 text-red-500">Could not load your conversations.</p>;
  }

  // Transform the data to match the ChatInterface expectations
  const initialConversations: Conversation[] = conversationData.conversations.map(conv => ({
    channelUserId: conv.channelUserId,
    updatedAt: conv.updatedAt,
  }));

  return (
    <div className="w-full max-w-7xl mx-auto p-4 flex flex-col">
      <h1 className="text-2xl font-bold mb-4 text-white">Your Conversations</h1>
      {/* This container gives the chat component a fixed height relative to the viewport */}
      <div className="h-[70vh]">
        <ChatInterface
          initialConversations={initialConversations}
          preselectedChannelUserId={conversationData.preselectedChannelUserId}
        />
      </div>
    </div>
  );
}
