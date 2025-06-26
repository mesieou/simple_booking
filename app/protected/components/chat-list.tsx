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
      <div className="h-full max-h-full overflow-hidden flex flex-col">
        <h2 className="text-lg font-semibold p-6 border-b border-white/10 flex-shrink-0">Chats</h2>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-center">No active conversations yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-h-full overflow-hidden flex flex-col">
      <h2 className="text-lg font-semibold p-6 border-b border-white/10 flex-shrink-0">Chats</h2>
      <div className="flex-1 overflow-y-auto">
        <ul>
          {conversations.map((convo) => (
            <li
              key={convo.channelUserId}
              tabIndex={0}
              role="button"
              aria-pressed={selectedUserId === convo.channelUserId}
              onClick={() => onConversationSelect(convo.channelUserId)}
              onKeyDown={(e) => e.key === 'Enter' && onConversationSelect(convo.channelUserId)}
              className={`h-20 px-6 py-4 cursor-pointer hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-150 flex flex-col justify-center relative ${
                selectedUserId === convo.channelUserId ? "bg-purple-600/30" : ""
              } ${
                convo.hasEscalation 
                  ? convo.escalationStatus === 'pending' 
                    ? "border-2 border-l-4 border-yellow-500 bg-yellow-900/20" 
                    : "border-2 border-l-4 border-green-500 bg-green-900/20"
                  : "border-b border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold flex items-center gap-3 min-w-0">
                  <span className="w-36 truncate text-sm">
                    {convo.channelUserId}
                  </span>
                  {convo.hasEscalation && (
                    <span className="flex items-center flex-shrink-0">
                      {convo.escalationStatus === 'pending' ? (
                        <span className="text-yellow-500 text-sm font-medium">
                          ⚠️ Attention Required
                        </span>
                      ) : convo.escalationStatus === 'attending' ? (
                        <span className="text-green-500 text-sm font-medium">
                          ✓ Attending
                        </span>
                      ) : null}
                    </span>
                  )}
                </p>
                {convo.hasEscalation && (
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    convo.escalationStatus === 'pending' 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                  }`}></div>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                Last activity:{" "}
                {new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 