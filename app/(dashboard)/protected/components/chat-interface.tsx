'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatLayout } from "./chat-layout";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { NotificationPanel } from "./notification-panel";
import { RightMenuPanel } from "./right-menu-panel";
import { getMessagesForUser, getUserBusinessId, getBusinessConversations } from "../../../actions";
import { ChatMessage } from "@/types/chat";
import { useRealtimeChat } from "../hooks/useRealtimeChat";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { PaymentSetupStatus } from "./payment-setup-status";

import { Conversation } from "@/types/chat";

type ChatInterfaceProps = {
  initialConversations: Conversation[];
  preselectedChannelUserId?: string;
  isSuperAdmin?: boolean;
};

export default function ChatInterface({ 
  initialConversations, 
  preselectedChannelUserId,
  isSuperAdmin = false
}: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [userBusinessId, setUserBusinessId] = useState<string | null>(null);
  const [chatStatusRefreshTrigger, setChatStatusRefreshTrigger] = useState<number>(0);
  const [notificationRefreshTrigger, setNotificationRefreshTrigger] = useState<number>(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Initialize business ID
  useEffect(() => {
    const initBusinessId = async () => {
      const businessId = await getUserBusinessId();
      setUserBusinessId(businessId);
    };
    initBusinessId();
    
    // Cleanup timeouts on unmount
    return () => {
      if (refreshConversationsTimeoutRef.current) {
        clearTimeout(refreshConversationsTimeoutRef.current);
      }
      if (refreshMessagesTimeoutRef.current) {
        clearTimeout(refreshMessagesTimeoutRef.current);
      }
    };
  }, []);

  // Callback functions for realtime updates
  const refreshMessagesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const refreshMessages = useCallback(async (channelUserId: string) => {
    // Clear existing timeout
    if (refreshMessagesTimeoutRef.current) {
      clearTimeout(refreshMessagesTimeoutRef.current);
    }
    
    // Debounce the refresh by 200ms
    refreshMessagesTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[ChatInterface] Refreshing messages for:', channelUserId, '(debounced)');
        const fetchedMessages = await getMessagesForUser(channelUserId);
        setMessages(fetchedMessages);
      } catch (err) {
        console.error('[ChatInterface] Error refreshing messages:', err);
      }
    }, 200);
  }, []);

  // Add debounce to prevent excessive API calls
  const refreshConversationsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const refreshConversations = useCallback(async () => {
    // Clear existing timeout
    if (refreshConversationsTimeoutRef.current) {
      clearTimeout(refreshConversationsTimeoutRef.current);
    }
    
    // Debounce the refresh by 300ms
    refreshConversationsTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[ChatInterface] Refreshing conversations (debounced)');
        const updatedConversations = await getBusinessConversations();
        setConversations(updatedConversations);
      } catch (err) {
        console.error('[ChatInterface] Error refreshing conversations:', err);
      }
    }, 300);
  }, []);

  const refreshChatStatus = useCallback(() => {
    // Increment the trigger to cause ChatWindow to refresh its status
    console.log('[ChatInterface] Chat status refresh requested, incrementing trigger');
    setChatStatusRefreshTrigger(prev => prev + 1);
  }, []);

  const refreshNotifications = useCallback(() => {
    // Increment the trigger to cause NotificationPanel to refresh
    console.log('[ChatInterface] Notification refresh requested, incrementing trigger');
    setNotificationRefreshTrigger(prev => prev + 1);
  }, []);

  // Setup realtime subscriptions
  const { isConnected } = useRealtimeChat({
    userBusinessId: userBusinessId,
    isSuperAdmin: isSuperAdmin,
    selectedUserId: selectedUserId || undefined,
    onMessagesUpdate: refreshMessages,
    onConversationsUpdate: refreshConversations,
    onChatStatusUpdate: refreshChatStatus,
    onNotificationsUpdate: refreshNotifications,
  });

  useEffect(() => {
    // On component mount, check if there's a preselected session ID.
    if (preselectedChannelUserId) {
      const matchingConversation = initialConversations.find(c => c.channelUserId === preselectedChannelUserId);
      if (matchingConversation) {
        setSelectedUserId(matchingConversation.channelUserId);
      }
    }
  }, [preselectedChannelUserId, initialConversations]);

  useEffect(() => {
    if (!selectedUserId) {
      setMessages([]);
      setSelectedSessionId(null);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedMessages = await getMessagesForUser(selectedUserId);
        setMessages(fetchedMessages);
        
        // Get session ID directly from the selected conversation
        const selectedConv = conversations.find(c => c.channelUserId === selectedUserId);
        setSelectedSessionId(selectedConv?.sessionId || null);
      } catch (err) {
        setError("Failed to load messages. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [selectedUserId, conversations]);

  const handleConversationSelect = (userId: string) => {
    setSelectedUserId(userId);
  };

  const handleBack = () => {
      setSelectedUserId(null);
  }

  const handleStaffMessageSent = useCallback((message: string) => {
    if (!selectedUserId) {
      console.log('[ChatInterface] Message sent, but no user selected. Cannot update.');
      return;
    }
    
    // Create optimistic message
    const optimisticMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'staff',
      senderRole: 'staff',
      content: message,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    // Add to local state immediately
    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    // Trigger background refresh for consistency
    console.log('[ChatInterface] Optimistically updated UI, triggering background refresh for:', selectedUserId);
    refreshMessages(selectedUserId);
  }, [selectedUserId, refreshMessages]);

  const handleNotificationClick = useCallback((channelUserId: string, sessionId: string) => {
    console.log('[ChatInterface] Notification clicked for:', channelUserId, 'sessionId:', sessionId);
    setSelectedUserId(channelUserId);
    // Open the panel if it's closed on desktop
    if (!isPanelOpen) {
      setIsPanelOpen(true);
    }
  }, [isPanelOpen]);
  
  const selectedConversation = conversations.find(c => c.channelUserId === selectedUserId);

  return (
    <div className="h-full flex flex-col max-h-full overflow-hidden">
      {/* Payment Setup Status Banner */}
      <div className="flex-shrink-0 p-2">
        <PaymentSetupStatus businessId={userBusinessId || undefined} />
      </div>
      
      {/* Top Bar with Realtime Status and Menu Button - Always Visible */}
      <div className="flex justify-end items-center p-2 gap-4 flex-shrink-0">
        {userBusinessId && (
          <div className="px-3 py-1 bg-slate-800/60 rounded-full text-xs text-gray-300 border border-white/10 inline-flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
            Realtime: {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        )}
        <Button
            variant="ghost"
            size="icon"
            className="text-gray-300 hover:text-white transition-opacity duration-300"
            onClick={() => setIsMenuOpen(true)}
        >
            <Menu className="h-7 w-7" />
        </Button>
      </div>
      
      <div className="flex-1 min-h-0">
        <ChatLayout
          selectedUserId={selectedUserId}
          hasNotifications={conversations.some(c => c.hasEscalation)}
          onBack={handleBack}
          isPanelOpen={isPanelOpen}
          setIsPanelOpen={setIsPanelOpen}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          notificationPanel={
            <NotificationPanel
              onNotificationClick={handleNotificationClick}
              refreshTrigger={notificationRefreshTrigger}
            />
          }
          rightMenuPanel={
            <RightMenuPanel onClose={() => setIsMenuOpen(false)} />
          }
          chatList={
            <ChatList
              conversations={conversations}
              selectedUserId={selectedUserId}
              onConversationSelect={handleConversationSelect}
              isSuperAdmin={isSuperAdmin}
            />
          }
          chatWindow={
            <ChatWindow 
                conversation={selectedConversation} 
                messages={messages}
                isLoading={isLoading}
                error={error}
                sessionId={selectedSessionId || undefined}
                onMessageSent={handleStaffMessageSent}
                chatStatusRefreshTrigger={chatStatusRefreshTrigger}
                onBack={handleBack}
            />
          }
        />
      </div>
    </div>
  );
} 