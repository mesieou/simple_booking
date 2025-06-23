import { createClient } from "../../lib/database/supabase/server";
import { redirect } from "next/navigation";

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

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Conversations</h1>
      <div className="border rounded-lg">
        {chatSessions && chatSessions.length > 0 ? (
          <ul>
            {chatSessions.map((session: any) => (
              <li key={session.id} className="p-4 border-b last:border-b-0">
                <p className="font-semibold">Chat with: {session.channelUserId}</p>
                <p className="text-sm text-gray-500">Session ID: {session.id}</p>
                 <p className="text-xs text-gray-400">Last updated: {new Date(session.updatedAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>No active conversations yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
