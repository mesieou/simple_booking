import { createClient } from "../../lib/database/supabase/server";
import { redirect } from "next/navigation";
import { type latest_chat_conversations } from "../../types/database";

export const dynamic = 'force-dynamic';

export default async function ProtectedPage() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Securely fetch conversations from our view.
  // RLS ensures we only see data for the logged-in user's business.
  const { data: conversations, error } = await supabase
    .from("latest_chat_conversations")
    .select("*");
    
  if (error) {
    console.error("Error fetching conversations:", error);
    return <p className="text-red-500 p-4">Error loading conversations.</p>;
  }
  
  // For debugging, we can log the fetched conversations to the server console.
  console.log('Fetched conversations for business:', conversations);

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto p-4 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Business Conversations</h1>
        <p className="text-muted-foreground">The following conversations were found for your business.</p>
      </div>
      <div className="border rounded-lg">
        {conversations && conversations.length > 0 ? (
          <ul>
            {conversations.map((convo: latest_chat_conversations) => (
              <li key={convo.id} className="p-4 border-b last:border-b-0">
                <p className="font-semibold">User ID: {convo.channelUserId}</p>
                <p className="text-sm text-muted-foreground truncate">Last Message: "{convo.last_message_preview}"</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last active: {new Date(convo.last_message_timestamp).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>No active conversations found for this business.</p>
          </div>
        )}
      </div>
    </div>
  );
}
