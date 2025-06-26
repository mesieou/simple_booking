'use client';

import { useState, useEffect, useCallback } from "react";
import { ChatLayout } from "./chat-layout";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { NotificationPanel } from "./notification-panel";
import { getMessagesForUser, ChatMessage, getUserBusinessId, getBusinessConversations } from "../../actions";
import { useRealtimeChat } from "../hooks/useRealtimeChat";

// Represents a unique conversation with a user, aggregated from one or more sessions.
export type Conversation = {
  channelUserId: string;
  updatedAt: string;
  hasEscalation: boolean;
  escalationStatus: string | null;
  sessionId: string;
};

type ChatInterfaceProps = {
  initialConversations: Conversation[];
  preselectedChannelUserId?: string;
};

export default function ChatInterface({ 
  initialConversations, 
  preselectedChannelUserId 
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

  // Initialize business ID
  useEffect(() => {
    const initBusinessId = async () => {
      const businessId = await getUserBusinessId();
      setUserBusinessId(businessId);
    };
    initBusinessId();
  }, []);

  // Callback functions for realtime updates
  const refreshMessages = useCallback(async (channelUserId: string) => {
    try {
      console.log('[ChatInterface] Refreshing messages for:', channelUserId);
      const fetchedMessages = await getMessagesForUser(channelUserId);
      setMessages(fetchedMessages);
    } catch (err) {
      console.error('[ChatInterface] Error refreshing messages:', err);
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      console.log('[ChatInterface] Refreshing conversations');
      const updatedConversations = await getBusinessConversations();
      setConversations(updatedConversations);
    } catch (err) {
      console.error('[ChatInterface] Error refreshing conversations:', err);
    }
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
    userBusinessId: userBusinessId || undefined,
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

  const handleMessageSent = useCallback(() => {
    // When a message is sent, this will be called by ChatWindow
    // The realtime subscription will automatically update the messages
    // but we can also trigger a manual refresh as backup
    if (selectedUserId) {
      refreshMessages(selectedUserId);
    }
  }, [selectedUserId, refreshMessages]);

  const handleNotificationClick = useCallback((channelUserId: string, sessionId: string) => {
    console.log('[ChatInterface] Notification clicked for:', channelUserId, 'sessionId:', sessionId);
    
    // Find the conversation for this channelUserId
    const conversation = conversations.find(c => c.channelUserId === channelUserId);
    if (conversation) {
      setSelectedUserId(channelUserId);
    } else {
      // If conversation not in current list, refresh conversations first
      refreshConversations().then(() => {
        setSelectedUserId(channelUserId);
      });
    }
  }, [conversations, refreshConversations]);
  
  const selectedConversation = conversations.find(c => c.channelUserId === selectedUserId);

  return (
    <div className="h-full flex flex-col max-h-full overflow-hidden">
      {/* Small independent Realtime Connection Status */}
      {userBusinessId && (
        <div className="flex justify-end p-2 flex-shrink-0">
          <div className="px-3 py-1 bg-slate-800/60 rounded-full text-xs text-gray-300 border border-white/10 inline-flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
            Realtime: {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      )}
      
      <div className="flex-1 min-h-0">
        <ChatLayout
          notificationPanel={
            <NotificationPanel
              onNotificationClick={handleNotificationClick}
              refreshTrigger={notificationRefreshTrigger}
            />
          }
          chatList={
            <ChatList
              conversations={conversations}
              selectedUserId={selectedUserId}
              onConversationSelect={handleConversationSelect}
            />
          }
          chatWindow={
            <ChatWindow 
                conversation={selectedConversation} 
                messages={messages}
                isLoading={isLoading}
                error={error}
                sessionId={selectedSessionId || undefined}
                onMessageSent={handleMessageSent}
                chatStatusRefreshTrigger={chatStatusRefreshTrigger}
            />
          }
        />
      </div>
    </div>
  );
} 