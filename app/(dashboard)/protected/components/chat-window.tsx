// This will render the chat window for the selected chat
import { Conversation } from "@/types/chat";
import { ChatMessage } from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import InteractiveMessage from "./InteractiveMessage";
import CustomAudioPlayer from "./CustomAudioPlayer";

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

// Helper to get a string representation of message content for keys/ids
const getContentKey = (content: ChatMessage['content']): string => {
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object') {
    // Create a stable key from the interactive content
    const text = content.text || '';
    const buttons = content.buttons?.map(b => b.buttonValue).join(',') || '';
    return `${text}-${buttons}`;
  }
  return ''; // Fallback for unexpected content types
};

type ChatWindowProps = {
    conversation: Conversation | undefined;
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    sessionId?: string;
    onMessageSent?: (message: string) => void;
    chatStatusRefreshTrigger?: number;
    onBack: () => void;
};

interface ChatStatus {
  hasEscalation: boolean;
  escalationStatus: string | null;
  isUnderAdminControl: boolean;
  controlledByUserId: string | null;
  controlTakenAt: string | null;
  isCurrentUserInControl: boolean;
  canTakeControl: boolean;
  canSendMessages: boolean;
  notificationId: string | null;
}

interface FeedbackState {
  isOpen: boolean;
  messageContent: string | object;
  feedbackType: 'thumbs_up' | 'thumbs_down' | null;
}

export function ChatWindow({ 
  conversation, 
  messages, 
  isLoading, 
  error, 
  sessionId, 
  onMessageSent, 
  chatStatusRefreshTrigger,
  onBack
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
  const handleFeedbackClick = (messageContent: string | object, type: 'thumbs_up' | 'thumbs_down') => {
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

  const submitFeedback = async (messageContent: string | object, type: 'thumbs_up' | 'thumbs_down', text: string) => {
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
        messageContent: getContentKey(messageContent), // Convert to string safely
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
        const feedbackKey = `${sessionId}-${getContentKey(messageContent)}`;
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
          const feedbackKey = `${currentSessionId}-${getContentKey(feedback.messageContent)}`;
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
            isUnderAdminControl: false, // We don't have this from conversation data
            controlledByUserId: null,
            controlTakenAt: null,
            isCurrentUserInControl: false,
            canTakeControl: true, // Default to allowing take control
            canSendMessages: false, // Default to not allowing messages without control
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
          isUnderAdminControl: false, // We don't have this from conversation data
          controlledByUserId: null,
          controlTakenAt: null,
          isCurrentUserInControl: false,
          canTakeControl: true, // Default to allowing take control
          canSendMessages: false, // Default to not allowing messages without control
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
        console.log('[ChatWindow] Message sent successfully');
        
        // Trigger callback to update messages via realtime or manual refresh
        if (onMessageSent) {
          onMessageSent(messageText);
        }
        setMessageText("");
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
      <div className="flex-1 flex h-full items-center justify-center text-gray-400 p-4">
        <p className="text-sm text-center">Select a conversation from the list to see the messages.</p>
      </div>
    );
  }

    return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Main Header - Fixed background */}
      <div className="p-3 border-b border-white/10 bg-slate-900/40">
        <div className="flex items-center justify-between gap-3">
            <button
                onClick={onBack}
                className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white"
                >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
          <button 
            onClick={handleShowUserDetails}
            className="text-sm font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer truncate"
          >
            Chat with {conversation.channelUserId}
          </button>
          
          {/* Staff Control Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {statusLoading && (
              <span className="text-gray-400 text-[11px]">Loading...</span>
            )}
            
            {chatStatus?.canTakeControl && (
              <button
                onClick={handleTakeControl}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Taking..." : "Take Control"}
              </button>
            )}
            
            {chatStatus?.isCurrentUserInControl && (
              <button
                onClick={handleFinishAssistance}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Finishing..." : "Release Control"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Notification - Transparent overlay only within chat */}
      {chatStatus?.hasEscalation && showNotification && (
        <div className="absolute top-[50px] left-0 right-0 z-10 pointer-events-none p-2">
          {chatStatus.escalationStatus === 'pending' && (
            <div className="px-3 py-2 bg-yellow-900/20 border border-yellow-500/30 rounded-md text-[11px] text-yellow-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-sm">⚠️</span>
                  <span className="truncate">Customer requested human assistance</span>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="pointer-events-auto text-yellow-400 hover:text-yellow-300 transition-colors ml-2 p-1 rounded-full"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {chatStatus.escalationStatus === 'attending' && (
            <div className="px-3 py-2 bg-green-900/20 border border-green-500/30 rounded-md text-[11px] text-green-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-sm">✅</span>
                  <span className="truncate">You are currently assisting this customer</span>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="pointer-events-auto text-green-400 hover:text-green-300 transition-colors ml-2 p-1 rounded-full"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        
        <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto max-h-full">
            {isLoading && <div className="text-center text-gray-400 py-4 text-xs">Loading messages...</div>}
            {error && <div className="text-center text-red-400 py-4 text-xs">{error}</div>}
            {!isLoading && !error && messages.length === 0 && (
                 <div className="text-center py-8">
                   <div className="text-4xl opacity-50 mb-2">💬</div>
                   <p className="text-gray-400 text-xs">This is the beginning of your conversation.</p>
                   <p className="text-gray-500 text-[11px] mt-1">Messages will appear here</p>
                 </div>
            )}
            <div className="space-y-4">
                {messages.map((msg, index) => {
                    const isBot = msg.senderRole === 'bot';
                    const feedbackKey = `${sessionId}-${getContentKey(msg.content)}`;
                    const feedbacks = messageFeedbacks.get(feedbackKey) || [];
                    const hasThumbsUp = feedbacks.some(f => f.type === 'thumbs_up');
                    const hasThumbsDown = feedbacks.some(f => f.type === 'thumbs_down');

                    let senderName, senderColor;
                    switch (msg.senderRole) {
                        case 'bot':
                            senderName = 'Bot';
                            senderColor = 'text-sky-300';
                            break;
                        case 'staff':
                            senderName = 'Staff';
                            senderColor = 'text-sky-400';
                            break;
                        case 'customer':
                            senderName = conversation?.channelUserId || 'Customer';
                            senderColor = 'text-sky-300';
                            break;
                    }
                    
                    return (
                        <div
                            key={msg.id}
                            className={`flex ${msg.senderRole === 'customer' ? 'justify-start' : 'justify-end'}`}
                        >
                            <div className="flex flex-col max-w-sm md:max-w-lg">
                                <div
                                    className={`p-3 md:p-3 rounded-lg text-white ${
                                        msg.senderRole === 'customer'
                                        ? 'bg-slate-700'
                                        : msg.senderRole === 'staff' 
                                        ? 'bg-green-600'
                                        : 'bg-purple-600'
                                    }`}
                                >
                                    {senderName && (
                                        <p className={`text-xs font-bold mb-1.5 opacity-90 ${senderColor}`}>
                                            {senderName}
                                        </p>
                                    )}
                                    {/* Render Bot's Interactive Message */}
                                    {isBot && msg.displayType === 'interactive' && typeof msg.content === 'object' ? (
                                        <InteractiveMessage content={msg.content} />
                                    ) : 
                                    
                                    /* Unified handler for text and attachments */
                                    (<>
                                        {(() => {
                                            // Part 1: Handle customer's selection from a menu
                                            if (msg.senderRole === 'customer') {
                                              const prevMessage = messages[index - 1];
                                              if (prevMessage && prevMessage.senderRole === 'bot' && prevMessage.displayType === 'interactive' && typeof prevMessage.content === 'object' && prevMessage.content.buttons) {
                                                const selectedButton = prevMessage.content.buttons.find(btn => btn.buttonValue === msg.content);
                                                if (selectedButton) {
                                                  return (
                                                    <div className="space-y-0.5 text-xs">
                                                      <p className="font-medium">{selectedButton.buttonText}</p>
                                                      {selectedButton.buttonDescription && (
                                                        <p className="text-gray-300">{selectedButton.buttonDescription}</p>
                                                      )}
                                                    </div>
                                                  );
                                                }
                                              }
                                            }
                                            
                                            // Part 2: Render standard message text (if it's not a placeholder)
                                            const placeholders = ['[IMAGE]', '[VIDEO]', '[DOCUMENT]', '[AUDIO]', '[STICKER]'];
                                            const isPlaceholder = typeof msg.content === 'string' && placeholders.includes(msg.content);

                                            if (!isPlaceholder) {
                                              // Handle different content types safely
                                              if (typeof msg.content === 'string') {
                                                return (
                                                  <p className="text-xs break-all">
                                                    {msg.senderRole === 'customer' 
                                                      ? formatMessageForAdmin(msg.content) 
                                                      : msg.content
                                                    }
                                                  </p>
                                                );
                                              } else if (typeof msg.content === 'object' && msg.content) {
                                                // Handle BotResponseMessage objects that weren't caught by displayType check
                                                return (
                                                  <p className="text-xs break-all">
                                                    {msg.content.text || '[Interactive Message]'}
                                                  </p>
                                                );
                                              }
                                            }
                                            return null; // Don't render any text if it's a placeholder
                                        })()}

                                        {/* Part 3: Render any attachments */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="mt-2 space-y-2">
                                                {msg.attachments.map((attachment, attachIndex) => (
                                                    <div key={attachIndex}>
                                                        {attachment.type === 'image' && attachment.url && (
                                                            <img 
                                                                src={attachment.url}
                                                                alt="Image"
                                                                className="max-w-xs max-h-64 rounded-lg cursor-pointer"
                                                                onClick={() => window.open(attachment.url, '_blank')}
                                                            />
                                                        )}
                                                        {attachment.type === 'sticker' && attachment.url && (
                                                            <img 
                                                                src={attachment.url}
                                                                alt="Sticker"
                                                                className="w-32 h-32 object-contain"
                                                            />
                                                        )}
                                                        {attachment.type === 'video' && attachment.url && (
                                                            <video 
                                                                src={attachment.url}
                                                                controls
                                                                className="max-w-xs max-h-64 rounded-lg"
                                                            />
                                                        )}
                                                        {attachment.type === 'audio' && attachment.url && (
                                                            <CustomAudioPlayer src={attachment.url} />
                                                        )}
                                                        {attachment.type === 'document' && attachment.url && (
                                                            <a 
                                                                href={attachment.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-600 hover:bg-slate-700"
                                                            >
                                                                <span className="text-2xl">📄</span>
                                                                <span className="text-xs text-blue-400 underline">
                                                                    {(attachment as any).originalFilename || 'Open Document'}
                                                                </span>
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>)}

                                    <p className="text-[11px] text-right text-white/60 mt-1.5">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                
                                {/* Feedback buttons - only for bot messages */}
                                {isBot && (
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mt-2 ml-auto">
                                        <span className="text-[11px] text-gray-400 mb-1 md:mb-0">Rate this response:</span>
                                        
                                        <div className="flex items-center gap-2">
                                            {/* Thumbs Up Button */}
                                            <button
                                                onClick={() => handleFeedbackClick(getContentKey(msg.content), 'thumbs_up')}
                                                disabled={submittingFeedback}
                                                className={`min-h-[36px] md:min-h-0 p-2 md:p-1.5 rounded-lg md:rounded-full transition-colors hover:bg-slate-600 disabled:opacity-50 ${
                                                    hasThumbsUp ? 'text-green-400 bg-green-900/20' : 'text-gray-400'
                                                }`}
                                                title="Good response"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                                </svg>
                                            </button>
                                            
                                            {/* Thumbs Down Button */}
                                            <button
                                                onClick={() => handleFeedbackClick(getContentKey(msg.content), 'thumbs_down')}
                                                disabled={submittingFeedback}
                                                className={`min-h-[36px] md:min-h-0 p-2 md:p-1.5 rounded-lg md:rounded-full transition-colors hover:bg-slate-600 disabled:opacity-50 ${
                                                    hasThumbsDown ? 'text-red-400 bg-red-900/20' : 'text-gray-400'
                                                }`}
                                                title="Poor response"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                                                </svg>
                                            </button>
                                            
                                            {/* Feedback count indicator */}
                                            {feedbacks.length > 0 && (
                                                <span className="text-[11px] text-gray-500 ml-1">
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
        
        <div className="p-2 border-t border-white/10 bg-slate-900/40">
            {/* Message input */}
            <form onSubmit={handleSendMessage} className="relative">
                <input
                    type="text"
                    placeholder={chatStatus?.canSendMessages ? "Type a message..." : "Take control to send messages"}
                    className="w-full pl-3 pr-10 py-2 border rounded-lg bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 text-xs"
                    disabled={!chatStatus?.canSendMessages || sendingMessage}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                />
                <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:hover:text-gray-400 rounded-full hover:bg-slate-600/50 transition-colors" 
                    disabled={!chatStatus?.canSendMessages || !messageText.trim() || sendingMessage}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
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
            <div className="fixed inset-4 md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 md:h-auto md:inset-auto bg-slate-800 rounded-lg border border-white/20 shadow-2xl z-50 p-5 overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-white">User Details</h3>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-1 hover:bg-slate-700 rounded-full transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - reduced spacing and font sizes */}
              <div className="space-y-4">
                {/* Phone Number */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1">Phone Number</label>
                  <p className="text-white text-sm">{conversation?.channelUserId}</p>
                </div>

                {/* User Name */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1">Name</label>
                  <p className="text-white text-sm">
                    {userDetails?.name || 'Not available'}
                  </p>
                </div>

                {/* WhatsApp Name (separate field for future enhancement) */}
                {userDetails?.whatsappName && (
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1">WhatsApp Profile Name</label>
                    <p className="text-white text-sm">{userDetails.whatsappName}</p>
                  </div>
                )}

                {/* Previous Escalations */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1">Previous Escalations</label>
                  <p className="text-white text-sm">
                    {userDetails?.escalationCount !== undefined 
                      ? `${userDetails.escalationCount} escalation${userDetails.escalationCount !== 1 ? 's' : ''}`
                      : 'Loading...'
                    }
                  </p>
                </div>

                {/* Last Escalation Date */}
                {userDetails?.lastEscalationDate && (
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1">Last Escalation</label>
                    <p className="text-white text-sm">
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
            <div className="fixed inset-4 md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 md:h-auto md:inset-auto bg-slate-800 rounded-lg border border-white/20 shadow-2xl z-50 p-5 overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-white">
                  👎 Provide Feedback
                </h3>
                <button
                  onClick={closeFeedbackModal}
                  className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-1 hover:bg-slate-700 rounded-full transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Message Preview */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-400 mb-2 block">Bot Message:</label>
                <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-gray-300 border border-slate-600">
                  {typeof feedbackState.messageContent === 'string' 
                    ? feedbackState.messageContent
                    : (feedbackState.messageContent as any)?.text || '[Interactive Message]'}
                </div>
              </div>

              {/* Feedback Text Input */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-400 mb-2 block">
                  What could be improved? (Optional)
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Describe what was wrong or how the bot could respond better..."
                  className="w-full min-h-[100px] p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-xs"
                  rows={4}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col md:flex-row gap-2 md:justify-end">
                <button
                  onClick={closeFeedbackModal}
                  className="min-h-[44px] md:min-h-0 px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg md:rounded border border-gray-600 md:border-0 text-xs"
                  disabled={submittingFeedback}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={submittingFeedback}
                  className="min-h-[44px] md:min-h-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
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