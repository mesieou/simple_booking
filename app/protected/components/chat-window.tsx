// This will render the chat window for the selected chat
import { Conversation } from "./chat-interface";
import { ChatMessage } from "../../actions";
import { useEffect, useRef, useState } from "react";

type ChatWindowProps = {
    conversation: Conversation | undefined;
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    sessionId?: string;
    onMessageSent?: () => void;
    chatStatusRefreshTrigger?: number;
};

interface ChatStatus {
  hasEscalation: boolean;
  escalationStatus: string | null;
  canTakeControl: boolean;
  isAttending: boolean;
  canSendMessages: boolean;
  notificationId: string | null;
}

export function ChatWindow({ 
  conversation, 
  messages, 
  isLoading, 
  error, 
  sessionId, 
  onMessageSent, 
  chatStatusRefreshTrigger 
}: ChatWindowProps) {
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat status when sessionId changes
  useEffect(() => {
    if (sessionId) {
      fetchChatStatus();
    } else {
      setChatStatus(null);
    }
  }, [sessionId]);

  // Listen for external refresh requests (from realtime)
  useEffect(() => {
    if (chatStatusRefreshTrigger && sessionId) {
      console.log('[ChatWindow] Chat status refresh triggered by realtime');
      fetchChatStatus();
    }
  }, [chatStatusRefreshTrigger, sessionId]);



  const fetchChatStatus = async () => {
    if (!sessionId) return;
    
    setStatusLoading(true);
    try {
      const response = await fetch(`/api/admin/chat-status?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (response.ok) {
        setChatStatus(data.status);
      } else {
        console.error("Failed to fetch chat status:", data.error);
      }
    } catch (error) {
      console.error("Error fetching chat status:", error);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleTakeControl = async () => {
    if (!sessionId) return;
    
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/take-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('[ChatWindow] Successfully took control');
        await fetchChatStatus(); // Refresh local status
      } else {
        alert("Error taking control: " + data.error);
      }
    } catch (error) {
      console.error("Error taking control:", error);
      alert("Failed to take control of chat");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !messageText.trim()) return;
    
    setSendingMessage(true);
    try {
      const response = await fetch('/api/admin/staff-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: messageText })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessageText("");
        console.log('[ChatWindow] Message sent successfully');
        
        // Trigger callback to update messages via realtime or manual refresh
        if (onMessageSent) {
          onMessageSent();
        }
      } else {
        alert("Error sending message: " + data.error);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFinishAssistance = async () => {
    if (!sessionId) return;
    
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/finish-assistance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('[ChatWindow] Successfully finished assistance');
        await fetchChatStatus(); // Refresh local status
      } else {
        alert("Error finishing assistance: " + data.error);
      }
    } catch (error) {
      console.error("Error finishing assistance:", error);
      alert("Failed to finish assistance");
    } finally {
      setActionLoading(false);
    }
  };

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
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Chat with {conversation.channelUserId}</h2>
              
              {/* Staff Control Buttons */}
              <div className="flex gap-2">
                {statusLoading && (
                  <span className="text-gray-400 text-sm">Loading status...</span>
                )}
                
                {chatStatus?.canTakeControl && (
                  <button
                    onClick={handleTakeControl}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Taking Control..." : "Take Control"}
                  </button>
                )}
                
                {chatStatus?.isAttending && (
                  <button
                    onClick={handleFinishAssistance}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Finishing..." : "Finish Assistance"}
                  </button>
                )}
              </div>
            </div>
            
            {/* Status Indicator */}
            {chatStatus?.hasEscalation && (
              <div className="mt-2 text-sm">
                {chatStatus.escalationStatus === 'pending' && (
                  <span className="text-yellow-400">⚠️ Customer requested human assistance</span>
                )}
                {chatStatus.escalationStatus === 'attending' && (
                  <span className="text-green-400">✅ You are currently assisting this customer</span>
                )}
              </div>
            )}
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
                                : msg.senderRole === 'staff' 
                                ? 'bg-green-600'
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
            {/* Message input */}
            <form onSubmit={handleSendMessage} className="relative">
                <input
                    type="text"
                    placeholder={chatStatus?.canSendMessages ? "Type a message..." : "Take control to send messages"}
                    className="w-full p-2 pr-12 border rounded-full bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    disabled={!chatStatus?.canSendMessages || sendingMessage}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                />
                <button 
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:hover:text-gray-400" 
                    disabled={!chatStatus?.canSendMessages || !messageText.trim() || sendingMessage}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                </button>
            </form>
        </div>
    </div>
  );
}