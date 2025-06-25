'use client';

import { useState, useEffect, useCallback } from "react";
import { ChatLayout } from "./chat-layout";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { getMessagesForUser, ChatMessage, getUserBusinessId, getBusinessConversations } from "../../actions";
import { useRealtimeChat } from "../hooks/useRealtimeChat";

// Represents a unique conversation with a user, aggregated from one or more sessions.
export type Conversation = {
  channelUserId: string;
  updatedAt: string;
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

  // Setup realtime subscriptions
  const { isConnected } = useRealtimeChat({
    userBusinessId,
    selectedUserId,
    onMessagesUpdate: refreshMessages,
    onConversationsUpdate: refreshConversations,
    onChatStatusUpdate: refreshChatStatus,
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
        
        // Find the session ID for this user's most recent conversation
        // This assumes the first message contains session info, or we need to fetch it separately
        if (fetchedMessages.length > 0) {
          // For now, we'll use a simple approach - try to get sessionId from URL or fetch it
          const urlParams = new URLSearchParams(window.location.search);
          const sessionIdFromUrl = urlParams.get('sessionId');
          setSelectedSessionId(sessionIdFromUrl);
        }
      } catch (err) {
        setError("Failed to load messages. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [selectedUserId]);

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
  
  const selectedConversation = conversations.find(c => c.channelUserId === selectedUserId);

  return (
    <div className="h-full">
      {/* Realtime Connection Status */}
      {userBusinessId && (
        <div className="px-4 py-1 bg-slate-900/60 text-xs text-gray-400 border-b border-white/10">
          Realtime: {isConnected ? '🟢 Connected' : '🟡 Connecting...'}
        </div>
      )}
      
      <ChatLayout
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
              sessionId={selectedSessionId}
              onMessageSent={handleMessageSent}
              chatStatusRefreshTrigger={chatStatusRefreshTrigger}
          />
        }
      />
    </div>
  );
} 