import { getEnvironmentServerClient } from "../../../lib/database/supabase/environment";
import { redirect } from "next/navigation";
import ChatInterface from "./components/chat-interface";
import { Conversation } from "./components/chat-interface";
import { ChatSession } from "../../../lib/database/models/chat-session";
import { User, SUPERADMIN_ROLES } from "../../../lib/database/models/user";

export const dynamic = 'force-dynamic';

export default async function ProtectedPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = getEnvironmentServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get sessionId from URL parameters
  const resolvedSearchParams = await searchParams;
  const sessionIdFromUrl = resolvedSearchParams?.sessionId as string | undefined;

  // Get user data to check role
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userError || !userData) {
    return <p className="p-4 text-red-500">Could not load user data.</p>;
  }

  const isSuperAdmin = SUPERADMIN_ROLES.includes(userData.role as any);

  // Use different method based on user role
  let conversationData;
  if (isSuperAdmin) {
    // Superadmin can see all conversations from all businesses
    conversationData = await ChatSession.getAllBusinessesConversationsData(sessionIdFromUrl);
  } else {
    // Regular users can only see their business conversations
    conversationData = await ChatSession.getBusinessConversationsData(
      user.id,
      sessionIdFromUrl
    );
  }

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
    // Add business info for superadmin
    ...(isSuperAdmin && {
      businessId: (conv as any).businessId,
      businessName: (conv as any).businessName,
    }),
  }));

  return (
    <div className="h-full w-full">
        <ChatInterface
          initialConversations={initialConversations}
          preselectedChannelUserId={conversationData.preselectedChannelUserId}
          isSuperAdmin={isSuperAdmin}
        />
    </div>
  );
}
