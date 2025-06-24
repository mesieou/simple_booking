// This will render the chat window for the selected chat
import { Conversation } from "./chat-interface";
import { ChatMessage } from "../../actions";
import { useEffect, useRef } from "react";

type ChatWindowProps = {
    conversation: Conversation | undefined;
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
};

export function ChatWindow({ conversation, messages, isLoading, error }: ChatWindowProps) {
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex h-full items-center justify-center text-gray-400">
        <p>Select a conversation from the list to see the messages.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-800/20">
        <div className="p-4 border-b border-white/10 bg-slate-900/40">
            <h2 className="text-xl font-semibold text-white">Chat with {conversation.channelUserId}</h2>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
            {isLoading && <div className="text-center text-gray-400">Loading messages...</div>}
            {error && <div className="text-center text-red-400">{error}</div>}
            {!isLoading && !error && messages.length === 0 && (
                 <p className="text-center text-gray-400 mt-10">This is the beginning of your conversation.</p>
            )}
            <div className="space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.senderRole === 'customer' ? 'justify-start' : 'justify-end'}`}
                    >
                        <div
                            className={`p-3 rounded-lg max-w-md text-white ${
                                msg.senderRole === 'customer'
                                ? 'bg-slate-700'
                                : 'bg-purple-600'
                            }`}
                        >
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-xs text-right text-white/60 mt-1">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
            <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-white/10 bg-slate-900/40">
            {/* Message input will go here */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="Type a message..."
                    className="w-full p-2 pr-12 border rounded-full bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-not-allowed" disabled>
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                </button>
            </div>
        </div>
    </div>
  );
}