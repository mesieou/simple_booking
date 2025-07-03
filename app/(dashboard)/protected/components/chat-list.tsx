// This will render the left column of the chat page (desktop) or tab content (mobile)
// It will display the list of active chats with mobile-optimized touch targets
import { Conversation } from "./chat-interface";

type ChatListProps = {
  conversations: Conversation[];
  selectedUserId: string | null;
  onConversationSelect: (userId: string) => void;
  isSuperAdmin?: boolean;
};

export function ChatList({
  conversations,
  selectedUserId,
  onConversationSelect,
  isSuperAdmin = false,
}: ChatListProps) {
    // If there are no active chats, display a message
  if (!conversations || conversations.length === 0) {
    return (
      <div className="h-full max-h-full overflow-hidden flex flex-col">
        <h2 className="text-base md:text-lg font-semibold p-4 md:p-6 border-b border-white/10 flex-shrink-0">Chats</h2>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-5xl mb-4 opacity-50">💬</div>
            <p className="text-gray-400 text-sm md:text-sm">No active conversations yet.</p>
            <p className="text-gray-500 text-xs md:text-xs mt-2">New chats will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-h-full overflow-hidden flex flex-col">
      <h2 className="text-base md:text-lg font-semibold p-4 md:p-6 border-b border-white/10 flex-shrink-0">
        Chats
        <span className="ml-2 text-xs text-gray-400 font-normal">({conversations.length})</span>
      </h2>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-white/5 md:divide-transparent">
          {conversations.map((convo) => (
            <li
              key={convo.channelUserId}
              tabIndex={0}
              role="button"
              aria-pressed={selectedUserId === convo.channelUserId}
              onClick={() => onConversationSelect(convo.channelUserId)}
              onKeyDown={(e) => e.key === 'Enter' && onConversationSelect(convo.channelUserId)}
              className={`min-h-[60px] md:h-auto px-4 md:px-6 py-3 cursor-pointer hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-150 flex flex-col justify-center relative ${
                selectedUserId === convo.channelUserId ? "bg-purple-600/30" : ""
              } ${
                convo.hasEscalation 
                  ? convo.escalationStatus === 'pending' 
                    ? "border-l-4 border-yellow-500 bg-yellow-900/20" 
                    : "border-l-4 border-green-500 bg-green-900/20"
                  : ""
              }`}
            >
              {/* Mobile Layout */}
              <div className="md:hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-semibold text-sm text-white truncate">
                      {convo.channelUserId}
                    </span>
                    {convo.hasEscalation && (
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        convo.escalationStatus === 'pending' 
                          ? 'bg-yellow-500' 
                          : 'bg-green-500'
                      }`}></div>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">
                    {new Date(convo.updatedAt).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false 
                    })}
                  </span>
                </div>
                
                {isSuperAdmin && convo.businessName && (
                  <div className="text-xs text-gray-500 mb-1">
                    {convo.businessName}
                  </div>
                )}
                
                {convo.hasEscalation && (
                  <div className="flex items-center gap-2">
                    {convo.escalationStatus === 'pending' ? (
                      <span className="inline-flex items-center gap-1 text-yellow-500 text-xs font-medium bg-yellow-500/10 px-2 py-0.5 rounded">
                        ⚠️ Needs Attention
                      </span>
                    ) : convo.escalationStatus === 'attending' ? (
                      <span className="inline-flex items-center gap-1 text-green-500 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded">
                        ✓ You're Helping
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Desktop Layout */}
              <div className="hidden md:block py-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold flex items-center gap-3 min-w-0">
                    <span className="w-36 truncate text-sm">
                      {convo.channelUserId}
                    </span>
                    {convo.hasEscalation && (
                      <span className="flex items-center flex-shrink-0">
                        {convo.escalationStatus === 'pending' ? (
                          <span className="text-yellow-500 text-xs font-medium">
                            ⚠️ Attention Required
                          </span>
                        ) : convo.escalationStatus === 'attending' ? (
                          <span className="text-green-500 text-xs font-medium">
                            ✓ Attending
                          </span>
                        ) : null}
                      </span>
                    )}
                  </p>
                  {convo.hasEscalation && (
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      convo.escalationStatus === 'pending' 
                        ? 'bg-yellow-500' 
                        : 'bg-green-500'
                    }`}></div>
                  )}
                </div>
                
                {isSuperAdmin && convo.businessName && (
                  <div className="text-xs text-gray-500 mb-1">
                    {convo.businessName}
                  </div>
                )}
                <p className="text-xs text-gray-400 truncate">
                  Last activity:{" "}
                  {new Date(convo.updatedAt).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 