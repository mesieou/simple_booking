import { createClient } from "../../../lib/database/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "./components/chat-interface";
import { Conversation } from "./components/chat-interface";
import { ChatSession } from "../../../lib/database/models/chat-session";

export const dynamic = 'force-dynamic';

export default async function ProtectedPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get sessionId from URL parameters
  const resolvedSearchParams = await searchParams;
  const sessionIdFromUrl = resolvedSearchParams?.sessionId as string | undefined;

  // Use centralized method to get all conversation data
  const conversationData = await ChatSession.getBusinessConversationsData(
    user.id,
    sessionIdFromUrl
  );

  if (!conversationData) {
    return <p className="p-4 text-red-500">Could not load your conversations.</p>;
  }

  // Transform the data to match the ChatInterface expectations
  const initialConversations: Conversation[] = conversationData.conversations.map(conv => ({
    channelUserId: conv.channelUserId,
    updatedAt: conv.updatedAt,
    hasEscalation: conv.hasEscalation,
    escalationStatus: conv.escalationStatus,
    sessionId: conv.sessionId,
  }));

  return (
    <div className="h-full w-full">
        <ChatInterface
          initialConversations={initialConversations}
          preselectedChannelUserId={conversationData.preselectedChannelUserId}
        />
    </div>
  );
}
