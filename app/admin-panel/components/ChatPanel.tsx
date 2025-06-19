'use client';

import { useEffect, useRef } from 'react';
import { UserInfo } from './UserInfo';
import { MessageInput } from './MessageInput';
import { EscalationControls } from './EscalationControls';
import { Conversation } from '../actions';
import { ChatMessage } from '@/lib/database/models/chat-session';

interface ChatPanelProps {
  conversation: Conversation;
  onSendMessage: (conversationId: string, messageText: string) => Promise<void>;
}

export const ChatPanel = ({ conversation, onSendMessage }: ChatPanelProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  const handleSendMessage = async (content: string) => {
    await onSendMessage(conversation.id, content);
  };

  const handleCloseEscalation = () => {
    console.log('Closing escalation - returning control to bot');
  };

  const getSenderStyle = (sender: ChatMessage['role']) => {
    switch (sender) {
      case 'user':
        return 'bg-secondary text-secondary-foreground self-start';
      case 'bot':
        return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 self-start';
      case 'human':
        return 'bg-primary text-primary-foreground self-end';
      default:
        return 'bg-muted text-muted-foreground self-start';
    }
  };

  const getSenderLabel = (sender: ChatMessage['role']) => {
    switch (sender) {
      case 'user': return 'Customer';
      case 'bot': return 'Bot';
      case 'human': return 'Agent';
      default: return 'System';
    }
  };
  
  const getAlignment = (sender: ChatMessage['role']) => {
    return sender === 'human' ? 'items-end' : 'items-start';
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border">
        <UserInfo customer={conversation} />
        {conversation.hasEscalation && <EscalationControls onCloseEscalation={handleCloseEscalation} />}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.map((message, index) => (
          <div key={`${message.timestamp}-${index}`} className={`flex flex-col ${getAlignment(message.role)}`}>
            <div className={`p-3 rounded-lg max-w-[80%] ${getSenderStyle(message.role)}`}>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
            </div>
            <div className="text-xs text-muted-foreground flex space-x-2 mt-1">
              <span>{getSenderLabel(message.role)}</span>
              <span>•</span>
              <span>{new Date(message.timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border">
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}; 