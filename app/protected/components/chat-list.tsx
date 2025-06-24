// This will render the left column of the chat page
// It will display the list of active chats
import { Conversation } from "./chat-interface";

type ChatListProps = {
  conversations: Conversation[];
  selectedUserId: string | null;
  onConversationSelect: (userId: string) => void;
};

export function ChatList({
  conversations,
  selectedUserId,
  onConversationSelect,
}: ChatListProps) {
    // If there are no active chats, display a message
  if (!conversations || conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 h-full flex items-center justify-center">
        <p>No active conversations yet.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <h2 className="text-lg font-semibold p-4 border-b border-white/10">Chats</h2>
      <ul>
        {conversations.map((convo) => (
          <li
            key={convo.channelUserId}
            tabIndex={0}
            role="button"
            aria-pressed={selectedUserId === convo.channelUserId}
            onClick={() => onConversationSelect(convo.channelUserId)}
            onKeyDown={(e) => e.key === 'Enter' && onConversationSelect(convo.channelUserId)}
            className={`p-4 border-b border-white/10 cursor-pointer hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-150 ${
              selectedUserId === convo.channelUserId ? "bg-purple-600/30" : ""
            }`}
          >
            <p className="font-semibold">{convo.channelUserId}</p>
            <p className="text-sm text-gray-400 truncate">
              Last activity:{" "}
              {new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
} 