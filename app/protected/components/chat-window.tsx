// This will render the chat window for the selected chat
import { Conversation } from "./chat-interface";
import { ChatMessage } from "../../actions";
import { useEffect, useRef, useState } from "react";

// Function to format technical button values into readable format for admin
const formatMessageForAdmin = (content: string): string => {
  // Handle UUID pattern (services)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(content)) {
    return '🔧 Service Selected';
  }

  // Handle time slots: slot_1_2025-06-30T00:00:00+00:00_11:00
  const slotMatch = content.match(/^slot_(\d+)_(\d{4}-\d{2}-\d{2})T.*_(\d{2}):(\d{2})$/);
  if (slotMatch) {
    const [, slotNum, date, hour, minute] = slotMatch;
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    return `📅 ${formattedDate} at ${hour}:${minute} (Slot ${slotNum})`;
  }

  // Handle day selection: day_2025-06-30
  const dayMatch = content.match(/^day_(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch) {
    const [, date] = dayMatch;
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    return `📅 ${formattedDate}`;
  }

  // Handle payment completion
  if (content.startsWith('PAYMENT_COMPLETED_')) {
    return '💳 Payment Completed';
  }

  // Handle specific button actions
  const buttonMappings: Record<string, string> = {
    // Main actions
    'add_another_service': '➕ Add Another Service',
    'continue_with_services': '✅ Continue with Services',
    'confirm_quote': '✅ Confirm Quote',
    'edit_quote': '✏️ Edit Quote',
    
    // Navigation
    'choose_another_day': '📅 Other Days',
    'choose_different_date': '📅 Choose Different Date',
    'choose_date': '📅 Choose Date',
    
    // Editing
    'edit_service': '🔄 Change Service',
    'edit_time': '⏰ Change Date/Time',
    
    // Address
    'address_confirmed': '✅ Address Correct',
    'address_edit': '✏️ Edit Address',
    
    // Support/Errors
    'contact_support': '📞 Contact Support',
    'system_error': '❌ System Error',
    'services_unavailable': '⚠️ Services Unavailable',
    'try_again': '🔄 Try Again',
    'restart_booking': '🔄 Restart Booking',
    
    // Account
    'use_registered_email': '📧 Use Registered Email',
    'no_email_available': '❌ No Email Available',
    
    // Special
    'start_booking_flow': '🎯 Start Booking'
  };

  // Check if content matches any button mapping
  if (buttonMappings[content]) {
    return buttonMappings[content];
  }

  // Return original content if no pattern matches
  return content;
};

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

interface FeedbackState {
  isOpen: boolean;
  messageContent: string;
  feedbackType: 'thumbs_up' | 'thumbs_down' | null;
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
  
  // Feedback system state
  const [feedbackState, setFeedbackState] = useState<FeedbackState>({
    isOpen: false,
    messageContent: '',
    feedbackType: null
  });
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [messageFeedbacks, setMessageFeedbacks] = useState<Map<string, Array<{type: 'thumbs_up' | 'thumbs_down', timestamp: string}>>>(new Map());

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Keep track of scroll position before feedback updates
  const preserveScrollPosition = () => {
    return messagesContainerRef.current?.scrollTop || 0;
  };

  const restoreScrollPosition = (scrollTop: number) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = scrollTop;
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

  // Feedback system handlers
  const handleFeedbackClick = (messageContent: string, type: 'thumbs_up' | 'thumbs_down') => {
    if (type === 'thumbs_up') {
      // For thumbs up, submit immediately without text
      submitFeedback(messageContent, type, '');
    } else {
      // For thumbs down, open window/modal for feedback text
      setFeedbackState({
        isOpen: true,
        messageContent,
        feedbackType: type
      });
      setFeedbackText('');
    }
  };

  const handleFeedbackSubmit = () => {
    if (feedbackState.messageContent && feedbackState.feedbackType) {
      submitFeedback(feedbackState.messageContent, feedbackState.feedbackType, feedbackText);
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackState({
      isOpen: false,
      messageContent: '',
      feedbackType: null
    });
    setFeedbackText('');
  };

  const submitFeedback = async (messageContent: string, type: 'thumbs_up' | 'thumbs_down', text: string) => {
    if (!sessionId) {
      console.error('[Feedback] No sessionId available for feedback submission');
      return;
    }
    
    console.log(`[Feedback] User clicked ${type} for message in session ${sessionId}`);
    console.log('[Feedback] Message content:', messageContent);
    if (type === 'thumbs_down' && text) {
      console.log('[Feedback] Feedback text provided:', text);
    }
    
    setSubmittingFeedback(true);
    try {
      const feedbackData = {
        sessionId,
        messageContent,
        feedbackType: type,
        feedbackText: text || null,
        timestamp: new Date().toISOString()
      };
      
      console.log('[Feedback] Sending feedback to API:', feedbackData);
      
      const response = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('[Feedback] Successfully saved feedback to database');
        console.log('[Feedback] API response:', result);
        
        // Preserve scroll position before updating state
        const currentScrollTop = preserveScrollPosition();
        
        // Create unique key for this session + message combination
        const feedbackKey = `${sessionId}-${messageContent}`;
        const currentFeedbacks = messageFeedbacks.get(feedbackKey) || [];
        currentFeedbacks.push({
          type,
          timestamp: new Date().toISOString()
        });
        setMessageFeedbacks(new Map(messageFeedbacks.set(feedbackKey, currentFeedbacks)));
        
        // Close modal if it was open
        if (feedbackState.isOpen) {
          closeFeedbackModal();
        }
        
        console.log('[Feedback] Local state updated, feedback UI should now show as given');
        
        // Restore scroll position after state update
        setTimeout(() => {
          restoreScrollPosition(currentScrollTop);
        }, 0);
        
      } else {
        console.error('[Feedback] API error:', result.error);
        alert('Error submitting feedback: ' + result.error);
      }
      
    } catch (error) {
      console.error('[Feedback] Network/parsing error:', error);
      alert('Error submitting feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Reset feedback state when conversation changes and load existing feedbacks
  useEffect(() => {
    console.log('[ChatWindow] Conversation or session changed, resetting feedback state');
    setMessageFeedbacks(new Map());
    setFeedbackState({
      isOpen: false,
      messageContent: '',
      feedbackType: null
    });
    setFeedbackText('');

    // Load existing feedbacks for this session
    if (sessionId) {
      loadExistingFeedbacks(sessionId);
    }
  }, [sessionId, conversation?.channelUserId]);

  const loadExistingFeedbacks = async (currentSessionId: string) => {
    try {
      console.log('[ChatWindow] Loading existing feedbacks for session:', currentSessionId);
      
      const response = await fetch(`/api/admin/feedback?sessionId=${currentSessionId}`);
      const result = await response.json();
      
      if (response.ok && result.feedbacks) {
        console.log('[ChatWindow] Found existing feedbacks:', result.feedbacks.length);
        
        // Preserve scroll position before updating state
        const currentScrollTop = preserveScrollPosition();
        
        // Convert existing feedbacks to our local state format
        const feedbackMap = new Map<string, Array<{type: 'thumbs_up' | 'thumbs_down', timestamp: string}>>();
        
        result.feedbacks.forEach((feedback: any) => {
          const feedbackKey = `${currentSessionId}-${feedback.messageContent}`;
          const existing = feedbackMap.get(feedbackKey) || [];
          existing.push({
            type: feedback.feedbackType,
            timestamp: feedback.timestamp
          });
          feedbackMap.set(feedbackKey, existing);
        });
        
        setMessageFeedbacks(feedbackMap);
        console.log('[ChatWindow] Loaded feedbacks into local state');
        
        // Restore scroll position after loading feedbacks
        setTimeout(() => {
          restoreScrollPosition(currentScrollTop);
        }, 0);
      } else {
        console.log('[ChatWindow] No existing feedbacks found or error loading them');
      }
    } catch (error) {
      console.error('[ChatWindow] Error loading existing feedbacks:', error);
    }
  };

  // Only scroll to bottom when messages actually change (not when feedback state changes)
  const messagesRef = useRef(messages);
  useEffect(() => {
    // Only scroll if messages actually changed (different length or different content)
    const hasNewMessages = messages.length !== messagesRef.current.length || 
                          JSON.stringify(messages) !== JSON.stringify(messagesRef.current);
    
    if (hasNewMessages) {
      console.log('[ChatWindow] New messages detected, scrolling to bottom');
      scrollToBottom();
      messagesRef.current = messages;
    }
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
      <div className="p-4 md:p-6 border-b border-white/10 bg-slate-900/40">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
          <button 
            onClick={handleShowUserDetails}
            className="text-lg md:text-xl font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer text-left"
          >
            Chat with {conversation.channelUserId}
          </button>
          
          {/* Staff Control Buttons */}
          <div className="flex flex-col md:flex-row gap-2 md:gap-3">
            {statusLoading && (
              <span className="text-gray-400 text-sm">Loading status...</span>
            )}
            
            {chatStatus?.canTakeControl && (
              <button
                onClick={handleTakeControl}
                disabled={actionLoading}
                className="min-h-[44px] px-4 md:px-6 py-3 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg md:rounded text-sm md:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Taking Control..." : "Take Control"}
              </button>
            )}
            
            {chatStatus?.isAttending && (
              <button
                onClick={handleFinishAssistance}
                disabled={actionLoading}
                className="min-h-[44px] px-4 md:px-6 py-3 md:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg md:rounded text-sm md:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Finishing..." : "Finish Assistance"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Notification - Transparent overlay only within chat */}
      {chatStatus?.hasEscalation && showNotification && (
        <div className="absolute top-[77px] md:top-[89px] left-0 right-0 z-10 pointer-events-none">
          {chatStatus.escalationStatus === 'pending' && (
            <div className="mx-4 md:mx-6 mb-4 px-4 py-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between text-sm md:text-sm text-yellow-400">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span>⚠️</span>
                  <span className="truncate">Customer requested human assistance</span>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="pointer-events-auto text-yellow-400 hover:text-yellow-300 transition-colors ml-3 p-1 md:p-0 min-h-[32px] min-w-[32px] md:min-h-0 md:min-w-0 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {chatStatus.escalationStatus === 'attending' && (
            <div className="mx-4 md:mx-6 mb-4 px-4 py-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between text-sm md:text-sm text-green-400">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span>✅</span>
                  <span className="truncate">You are currently assisting this customer</span>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="pointer-events-auto text-green-400 hover:text-green-300 transition-colors ml-3 p-1 md:p-0 min-h-[32px] min-w-[32px] md:min-h-0 md:min-w-0 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        
        <div ref={messagesContainerRef} className="flex-1 p-4 md:p-6 overflow-y-auto max-h-full">
            {isLoading && <div className="text-center text-gray-400 py-8">Loading messages...</div>}
            {error && <div className="text-center text-red-400 py-8">{error}</div>}
            {!isLoading && !error && messages.length === 0 && (
                 <div className="text-center py-12">
                   <div className="text-6xl opacity-50 mb-4">💬</div>
                   <p className="text-gray-400 text-base md:text-sm">This is the beginning of your conversation.</p>
                   <p className="text-gray-500 text-sm md:text-xs mt-2">Messages will appear here</p>
                 </div>
            )}
            <div className="space-y-4 md:space-y-6">
                {messages.map((msg) => {
                    const isBot = msg.senderRole === 'bot';
                    // Create unique key for this session + message combination
                    const feedbackKey = `${sessionId}-${msg.content}`;
                    const feedbacks = messageFeedbacks.get(feedbackKey) || [];
                    const hasThumbsUp = feedbacks.some(f => f.type === 'thumbs_up');
                    const hasThumbsDown = feedbacks.some(f => f.type === 'thumbs_down');
                    
                    return (
                        <div
                            key={msg.id}
                            className={`flex ${msg.senderRole === 'customer' ? 'justify-start' : 'justify-end'}`}
                        >
                            <div className="flex flex-col max-w-sm md:max-w-lg w-full md:w-auto">
                                <div
                                    className={`p-3 md:p-4 rounded-lg text-white ${
                                        msg.senderRole === 'customer'
                                        ? 'bg-slate-700'
                                        : msg.senderRole === 'staff' 
                                        ? 'bg-green-600'
                                        : 'bg-purple-600'
                                    }`}
                                >
                                    {/* Show message content - prioritize real attachments over placeholders */}
                                    {(msg.attachments && msg.attachments.length > 0) ? (
                                        // Has real attachments - show them and any caption text
                                        <div className="space-y-2">
                                            {/* Show any text content beyond the placeholder */}
                                            {msg.content.replace(/\[(IMAGE|VIDEO|DOCUMENT|AUDIO|STICKER)\]/g, '').trim() && (
                                                <p className="text-sm">
                                                  {msg.senderRole === 'customer' 
                                                    ? formatMessageForAdmin(msg.content.replace(/\[(IMAGE|VIDEO|DOCUMENT|AUDIO|STICKER)\]/g, '').trim())
                                                    : msg.content.replace(/\[(IMAGE|VIDEO|DOCUMENT|AUDIO|STICKER)\]/g, '').trim()}
                                                </p>
                                            )}
                                        </div>
                                    ) : (['[IMAGE]', '[VIDEO]', '[DOCUMENT]', '[AUDIO]', '[STICKER]'].some(placeholder => msg.content.includes(placeholder))) ? (
                                        // No real attachments but has placeholder - show placeholder as fallback
                                        <div className="space-y-2">
                                            {/* Media placeholder fallback */}
                                            <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/20">
                                                <div className="text-2xl">
                                                    {msg.content.includes('[IMAGE]') && '🖼️'}
                                                    {msg.content.includes('[VIDEO]') && '🎥'}
                                                    {msg.content.includes('[DOCUMENT]') && '📄'}
                                                    {msg.content.includes('[AUDIO]') && '🎵'}
                                                    {msg.content.includes('[STICKER]') && '😊'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {msg.content.includes('[IMAGE]') && 'Photo'}
                                                        {msg.content.includes('[VIDEO]') && 'Video'}
                                                        {msg.content.includes('[DOCUMENT]') && 'Document'}
                                                        {msg.content.includes('[AUDIO]') && 'Voice message'}
                                                        {msg.content.includes('[STICKER]') && 'Sticker'}
                                                    </p>
                                                    <p className="text-xs text-white/50">(File not available)</p>
                                                </div>
                                            </div>
                                            {/* Show any additional text content if it exists beyond the placeholder */}
                                            {msg.content.replace(/\[(IMAGE|VIDEO|DOCUMENT|AUDIO|STICKER)\]/g, '').trim() && (
                                                <p className="text-sm">
                                                  {msg.senderRole === 'customer' 
                                                    ? formatMessageForAdmin(msg.content.replace(/\[(IMAGE|VIDEO|DOCUMENT|AUDIO|STICKER)\]/g, '').trim())
                                                    : msg.content.replace(/\[(IMAGE|VIDEO|DOCUMENT|AUDIO|STICKER)\]/g, '').trim()}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        // Regular text message
                                        <p className="text-sm">
                                          {msg.senderRole === 'customer' ? formatMessageForAdmin(msg.content) : msg.content}
                                        </p>
                                    )}
                                    
                                    {/* Display real attachments if available */}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {msg.attachments.map((attachment, index) => (
                                                <div key={index} className="space-y-2">
                                                    {/* Images */}
                                                    {attachment.type === 'image' && attachment.url && (
                                                        <div className="relative">
                                                            <img 
                                                                src={attachment.url}
                                                                alt={attachment.caption || "Photo"}
                                                                className="max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                onClick={() => window.open(attachment.url, '_blank')}
                                                                onError={(e) => {
                                                                    // Fallback to placeholder if image fails to load
                                                                    const imgElement = e.currentTarget;
                                                                    imgElement.style.display = 'none';
                                                                    
                                                                    const placeholder = document.createElement('div');
                                                                    placeholder.className = 'flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/20';
                                                                    placeholder.innerHTML = '<span class="text-2xl">🖼️</span><div><p class="text-sm font-medium">Photo</p><p class="text-xs text-white/50">(Failed to load)</p></div>';
                                                                    imgElement.parentNode?.appendChild(placeholder);
                                                                }}
                                                            />
                                                            {attachment.caption && (
                                                                <p className="text-xs text-white/70 mt-1">{attachment.caption}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Videos */}
                                                    {attachment.type === 'video' && attachment.url && (
                                                        <div className="relative">
                                                            <video 
                                                                src={attachment.url}
                                                                controls
                                                                className="max-w-xs max-h-64 rounded-lg"
                                                                onError={(e) => {
                                                                    // Fallback to placeholder if video fails to load
                                                                    const videoElement = e.currentTarget;
                                                                    videoElement.style.display = 'none';
                                                                    
                                                                    const placeholder = document.createElement('div');
                                                                    placeholder.className = 'flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/20';
                                                                    placeholder.innerHTML = '<span class="text-2xl">🎥</span><div><p class="text-sm font-medium">Video</p><p class="text-xs text-white/50">(Failed to load)</p></div>';
                                                                    videoElement.parentNode?.appendChild(placeholder);
                                                                }}
                                                            />
                                                            {attachment.caption && (
                                                                <p className="text-xs text-white/70 mt-1">{attachment.caption}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Audio */}
                                                    {attachment.type === 'audio' && attachment.url && (
                                                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/20">
                                                            <span className="text-2xl">🎵</span>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium mb-2">Voice message</p>
                                                                <audio 
                                                                    src={attachment.url}
                                                                    controls
                                                                    className="w-full max-w-xs"
                                                                    onError={(e) => {
                                                                        const audioElement = e.currentTarget;
                                                                        audioElement.style.display = 'none';
                                                                        const errorText = document.createElement('p');
                                                                        errorText.className = 'text-xs text-white/50';
                                                                        errorText.textContent = '(Failed to load audio)';
                                                                        audioElement.parentNode?.appendChild(errorText);
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Documents */}
                                                    {attachment.type === 'document' && attachment.url && (
                                                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/20">
                                                            <span className="text-2xl">📄</span>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium">Document</p>
                                                                <a 
                                                                    href={attachment.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                                                                >
                                                                    Open document
                                                                </a>
                                                                {attachment.caption && (
                                                                    <p className="text-xs text-white/70 mt-1">{attachment.caption}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Stickers */}
                                                    {attachment.type === 'sticker' && attachment.url && (
                                                        <div className="relative">
                                                            <img 
                                                                src={attachment.url}
                                                                alt="Sticker"
                                                                className="w-24 h-24 object-contain"
                                                                onError={(e) => {
                                                                    // Fallback to placeholder if sticker fails to load
                                                                    const stickerElement = e.currentTarget;
                                                                    stickerElement.style.display = 'none';
                                                                    
                                                                    const placeholder = document.createElement('div');
                                                                    placeholder.className = 'flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/20 w-24';
                                                                    placeholder.innerHTML = '<span class="text-2xl">😊</span><div><p class="text-xs font-medium">Sticker</p><p class="text-xs text-white/50">(Failed to load)</p></div>';
                                                                    stickerElement.parentNode?.appendChild(placeholder);
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <p className="text-xs text-right text-white/60 mt-2">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                
                                {/* Feedback buttons - only for bot messages */}
                                {isBot && (
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mt-3 ml-auto">
                                        <span className="text-xs text-gray-400 mb-1 md:mb-0">Rate this response:</span>
                                        
                                        <div className="flex items-center gap-2">
                                            {/* Thumbs Up Button */}
                                            <button
                                                onClick={() => handleFeedbackClick(msg.content, 'thumbs_up')}
                                                disabled={submittingFeedback}
                                                className={`min-h-[44px] md:min-h-0 p-3 md:p-1.5 rounded-lg md:rounded-full transition-colors hover:bg-slate-600 disabled:opacity-50 ${
                                                    hasThumbsUp ? 'text-green-400 bg-green-900/20' : 'text-gray-400'
                                                }`}
                                                title="Good response"
                                            >
                                                <svg className="w-5 h-5 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                                </svg>
                                            </button>
                                            
                                            {/* Thumbs Down Button */}
                                            <button
                                                onClick={() => handleFeedbackClick(msg.content, 'thumbs_down')}
                                                disabled={submittingFeedback}
                                                className={`min-h-[44px] md:min-h-0 p-3 md:p-1.5 rounded-lg md:rounded-full transition-colors hover:bg-slate-600 disabled:opacity-50 ${
                                                    hasThumbsDown ? 'text-red-400 bg-red-900/20' : 'text-gray-400'
                                                }`}
                                                title="Poor response"
                                            >
                                                <svg className="w-5 h-5 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                                                </svg>
                                            </button>
                                            
                                            {/* Feedback count indicator */}
                                            {feedbacks.length > 0 && (
                                                <span className="text-xs text-gray-500 ml-1">
                                                    ({feedbacks.length})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 md:p-6 border-t border-white/10 bg-slate-900/40">
            {/* Message input */}
            <form onSubmit={handleSendMessage} className="relative">
                <input
                    type="text"
                    placeholder={chatStatus?.canSendMessages ? "Type a message..." : "Take control to send messages"}
                    className="w-full min-h-[48px] md:min-h-0 p-4 pr-12 md:pr-14 border rounded-xl md:rounded-full bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 text-base md:text-sm"
                    disabled={!chatStatus?.canSendMessages || sendingMessage}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                />
                <button 
                    type="submit"
                    className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-1 text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:hover:text-gray-400 rounded-full hover:bg-slate-600/50 transition-colors" 
                    disabled={!chatStatus?.canSendMessages || !messageText.trim() || sendingMessage}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
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
            <div className="fixed inset-4 md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 md:h-auto md:inset-auto bg-slate-800 rounded-lg border border-white/20 shadow-2xl z-50 p-6 overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl md:text-lg font-semibold text-white">User Details</h3>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1 hover:bg-slate-700 rounded-full transition-colors flex items-center justify-center"
                >
                  <svg className="w-6 h-6 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="space-y-6 md:space-y-4">
                {/* Phone Number */}
                <div>
                  <label className="text-sm md:text-sm font-medium text-gray-400 block mb-2">Phone Number</label>
                  <p className="text-white text-base md:text-sm">{conversation?.channelUserId}</p>
                </div>

                {/* User Name */}
                <div>
                  <label className="text-sm md:text-sm font-medium text-gray-400 block mb-2">Name</label>
                  <p className="text-white text-base md:text-sm">
                    {userDetails?.name || 'Not available'}
                  </p>
                </div>

                {/* WhatsApp Name (separate field for future enhancement) */}
                {userDetails?.whatsappName && (
                  <div>
                    <label className="text-sm md:text-sm font-medium text-gray-400 block mb-2">WhatsApp Profile Name</label>
                    <p className="text-white text-base md:text-sm">{userDetails.whatsappName}</p>
                  </div>
                )}

                {/* Previous Escalations */}
                <div>
                  <label className="text-sm md:text-sm font-medium text-gray-400 block mb-2">Previous Escalations</label>
                  <p className="text-white text-base md:text-sm">
                    {userDetails?.escalationCount !== undefined 
                      ? `${userDetails.escalationCount} escalation${userDetails.escalationCount !== 1 ? 's' : ''}`
                      : 'Loading...'
                    }
                  </p>
                </div>

                {/* Last Escalation Date */}
                {userDetails?.lastEscalationDate && (
                  <div>
                    <label className="text-sm md:text-sm font-medium text-gray-400 block mb-2">Last Escalation</label>
                    <p className="text-white text-base md:text-sm">
                      {new Date(userDetails.lastEscalationDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Feedback Modal */}
        {feedbackState.isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 z-50"
              onClick={closeFeedbackModal}
            ></div>
            
            {/* Modal */}
            <div className="fixed inset-4 md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 md:h-auto md:inset-auto bg-slate-800 rounded-lg border border-white/20 shadow-2xl z-50 p-6 overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl md:text-lg font-semibold text-white">
                  👎 Provide Feedback
                </h3>
                <button
                  onClick={closeFeedbackModal}
                  className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1 hover:bg-slate-700 rounded-full transition-colors flex items-center justify-center"
                >
                  <svg className="w-6 h-6 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Message Preview */}
              <div className="mb-6">
                <label className="text-sm md:text-sm font-medium text-gray-400 mb-3 block">Bot Message:</label>
                <div className="bg-slate-700/50 rounded-lg p-4 text-base md:text-sm text-gray-300 border border-slate-600">
                  {feedbackState.messageContent}
                </div>
              </div>

              {/* Feedback Text Input */}
              <div className="mb-8">
                <label className="text-sm md:text-sm font-medium text-gray-400 mb-3 block">
                  What could be improved? (Optional)
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Describe what was wrong or how the bot could respond better..."
                  className="w-full min-h-[120px] p-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-base md:text-sm"
                  rows={4}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col md:flex-row gap-3 md:justify-end">
                <button
                  onClick={closeFeedbackModal}
                  className="min-h-[48px] md:min-h-0 px-6 py-3 md:py-2 text-gray-400 hover:text-white transition-colors rounded-lg md:rounded border border-gray-600 md:border-0 text-base md:text-sm"
                  disabled={submittingFeedback}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={submittingFeedback}
                  className="min-h-[48px] md:min-h-0 px-6 py-3 md:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base md:text-sm font-medium"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          </>
        )}
    </div>
  );
}