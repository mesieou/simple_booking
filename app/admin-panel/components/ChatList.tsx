'use client';

import { Conversation } from '../actions';
import { formatDistanceToNow } from 'date-fns';

interface ChatListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (id: string) => void;
}

export const ChatList = ({ conversations, selectedConversationId, onSelectConversation }: ChatListProps) => {

  const totalEscalations = conversations.filter(c => c.hasEscalation).length;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Active Chats</h2>
        <p className="text-sm text-muted-foreground">Business: Salon Luna</p>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelectConversation(chat.id)}
            className={`p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors ${
              selectedConversationId === chat.id ? 'bg-accent' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 min-w-0">
                <h3 className="font-medium text-foreground truncate">{chat.customerName}</h3>
                {chat.hasEscalation && (
                  <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full flex-shrink-0">
                    Escalated
                  </span>
                )}
              </div>
              {chat.unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                  {chat.unreadCount}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">{chat.customerPhone}</p>
            <p className="text-sm text-muted-foreground truncate mb-2">{chat.lastMessage}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(chat.timestamp), { addSuffix: true })}
            </p>
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-border">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {totalEscalations} escalated chats
          </p>
        </div>
      </div>
    </div>
  );
}; 