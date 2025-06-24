'use client';

import { useState, useEffect } from "react";
import { ChatLayout } from "./chat-layout";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { getMessagesForUser, ChatMessage } from "../../actions";

// Represents a unique conversation with a user, aggregated from one or more sessions.
export type Conversation = {
  channelUserId: string;
  updatedAt: string;
};

type ChatInterfaceProps = {
  initialConversations: Conversation[];
};

export default function ChatInterface({ initialConversations }: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedUserId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedMessages = await getMessagesForUser(selectedUserId);
        setMessages(fetchedMessages);
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
  
  const selectedConversation = conversations.find(c => c.channelUserId === selectedUserId);

  return (
    <div className="h-full">
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
          />
        }
      />
    </div>
  );
} 