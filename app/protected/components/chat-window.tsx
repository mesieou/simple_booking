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
  const messagesContainerRef = useRef<null | HTMLDivElement>(null);
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [showNotification, setShowNotification] = useState(true);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const fetchUserDetails = async () => {
    if (!conversation?.channelUserId) return;
    
    try {
      const response = await fetch(`/api/admin/user-details?phoneNumber=${conversation.channelUserId}`);
      const data = await response.json();
      
      if (response.ok) {
        setUserDetails(data);
      } else {
        console.error("Failed to fetch user details:", data.error);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  const handleShowUserDetails = () => {
    setShowUserDetails(true);
    if (!userDetails) {
      fetchUserDetails();
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat status when sessionId changes or conversation changes
  useEffect(() => {
    if (sessionId) {
      console.log('[ChatWindow] SessionId changed to:', sessionId, 'fetching chat status');
      fetchChatStatus();
    } else {
      console.log('[ChatWindow] No sessionId, clearing chat status');
      setChatStatus(null);
    }
  }, [sessionId]);

  // Also fetch status when conversation escalation data changes  
  useEffect(() => {
    if (conversation?.hasEscalation && sessionId) {
      console.log('[ChatWindow] Conversation has escalation, ensuring status is current');
      setShowNotification(true); // Reset notification visibility for new escalations
      fetchChatStatus();
    }
  }, [conversation?.hasEscalation, conversation?.escalationStatus, sessionId]);

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
        // Reset notification visibility if there's a new escalation
        if (data.status?.hasEscalation) {
          setShowNotification(true);
        }
      } else {
        console.error("Failed to fetch chat status:", data.error);
        // Fallback to conversation escalation data if API fails
        if (conversation?.hasEscalation) {
          console.log('[ChatWindow] Using conversation escalation data as fallback');
          setChatStatus({
            hasEscalation: conversation.hasEscalation,
            escalationStatus: conversation.escalationStatus,
            canTakeControl: conversation.escalationStatus === 'pending',
            isAttending: conversation.escalationStatus === 'attending',
            canSendMessages: conversation.escalationStatus === 'attending',
            notificationId: null, // We don't have this from conversation data
          });
        }
      }
    } catch (error) {
      console.error("Error fetching chat status:", error);
      // Fallback to conversation escalation data if API fails
      if (conversation?.hasEscalation) {
        console.log('[ChatWindow] Using conversation escalation data as fallback');
        setChatStatus({
          hasEscalation: conversation.hasEscalation,
          escalationStatus: conversation.escalationStatus,
          canTakeControl: conversation.escalationStatus === 'pending',
          isAttending: conversation.escalationStatus === 'attending',
          canSendMessages: conversation.escalationStatus === 'attending',
          notificationId: null, // We don't have this from conversation data
        });
      }
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
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Main Header - Fixed background */}
      <div className="p-6 border-b border-white/10 bg-slate-900/40">
        <div className="flex justify-between items-center">
          <button 
            onClick={handleShowUserDetails}
            className="text-xl font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer text-left"
          >
            Chat with {conversation.channelUserId}
          </button>
          
          {/* Staff Control Buttons */}
          <div className="flex gap-3">
            {statusLoading && (
              <span className="text-gray-400 text-sm">Loading status...</span>
            )}
            
            {chatStatus?.canTakeControl && (
              <button
                onClick={handleTakeControl}
                disabled={actionLoading}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Taking Control..." : "Take Control"}
              </button>
            )}
            
            {chatStatus?.isAttending && (
              <button
                onClick={handleFinishAssistance}
                disabled={actionLoading}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Finishing..." : "Finish Assistance"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Notification - Transparent overlay only within chat */}
      {chatStatus?.hasEscalation && showNotification && (
        <div className="absolute top-[89px] left-0 right-0 z-10 pointer-events-none">
          {chatStatus.escalationStatus === 'pending' && (
            <div className="mx-6 mb-4 px-4 py-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between text-sm text-yellow-400">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Customer requested human assistance</span>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="pointer-events-auto text-yellow-400 hover:text-yellow-300 transition-colors ml-3"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {chatStatus.escalationStatus === 'attending' && (
            <div className="mx-6 mb-4 px-4 py-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between text-sm text-green-400">
                <div className="flex items-center gap-2">
                  <span>✅</span>
                  <span>You are currently assisting this customer</span>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="pointer-events-auto text-green-400 hover:text-green-300 transition-colors ml-3"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        
        <div ref={messagesContainerRef} className="flex-1 p-6 overflow-y-auto max-h-full">
            {isLoading && <div className="text-center text-gray-400">Loading messages...</div>}
            {error && <div className="text-center text-red-400">{error}</div>}
            {!isLoading && !error && messages.length === 0 && (
                 <p className="text-center text-gray-400 mt-10">This is the beginning of your conversation.</p>
            )}
            <div className="space-y-6">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.senderRole === 'customer' ? 'justify-start' : 'justify-end'}`}
                    >
                        <div
                            className={`p-4 rounded-lg max-w-lg text-white ${
                                msg.senderRole === 'customer'
                                ? 'bg-slate-700'
                                : msg.senderRole === 'staff' 
                                ? 'bg-green-600'
                                : 'bg-purple-600'
                            }`}
                        >
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-xs text-right text-white/60 mt-2">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
            <div ref={messagesEndRef} />
        </div>
        
        <div className="p-6 border-t border-white/10 bg-slate-900/40">
            {/* Message input */}
            <form onSubmit={handleSendMessage} className="relative">
                <input
                    type="text"
                    placeholder={chatStatus?.canSendMessages ? "Type a message..." : "Take control to send messages"}
                    className="w-full p-4 pr-14 border rounded-full bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    disabled={!chatStatus?.canSendMessages || sendingMessage}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                />
                <button 
                    type="submit"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:hover:text-gray-400" 
                    disabled={!chatStatus?.canSendMessages || !messageText.trim() || sendingMessage}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                </button>
            </form>
        </div>

        {/* User Details Modal */}
        {showUserDetails && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowUserDetails(false)}
            ></div>
            
            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-800 rounded-lg border border-white/20 shadow-2xl z-50 p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">User Details</h3>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="p-1 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* Phone Number */}
                <div>
                  <label className="text-sm font-medium text-gray-400">Phone Number</label>
                  <p className="text-white">{conversation?.channelUserId}</p>
                </div>

                {/* User Name */}
                <div>
                  <label className="text-sm font-medium text-gray-400">Name</label>
                  <p className="text-white">
                    {userDetails?.name || 'Not available'}
                  </p>
                </div>

                {/* WhatsApp Name (separate field for future enhancement) */}
                {userDetails?.whatsappName && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">WhatsApp Profile Name</label>
                    <p className="text-white">{userDetails.whatsappName}</p>
                  </div>
                )}

                {/* Previous Escalations */}
                <div>
                  <label className="text-sm font-medium text-gray-400">Previous Escalations</label>
                  <p className="text-white">
                    {userDetails?.escalationCount !== undefined 
                      ? `${userDetails.escalationCount} escalation${userDetails.escalationCount !== 1 ? 's' : ''}`
                      : 'Loading...'
                    }
                  </p>
                </div>

                {/* Last Escalation Date */}
                {userDetails?.lastEscalationDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Last Escalation</label>
                    <p className="text-white">
                      {new Date(userDetails.lastEscalationDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
    </div>
  );
}