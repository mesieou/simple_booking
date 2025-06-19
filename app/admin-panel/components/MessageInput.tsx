'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
}

export const MessageInput = ({ onSendMessage }: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error("Failed to send message:", error);
      // Optionally show an error to the user
    } finally {
      setIsSending(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (value: string) => {
    setMessage(value);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Quick response templates
  const quickReplies = [
    "I'm looking into this for you...",
    "Let me check your account details.",
    "I'll escalate this to the appropriate department.",
    "Thank you for your patience.",
    "Is there anything else I can help you with?"
  ];

  const handleQuickReply = (reply: string) => {
    setMessage(reply);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="p-4 bg-card">
      {/* Quick Replies */}
      <div className="mb-3">
        <div className="text-xs text-muted-foreground mb-2">Quick Replies:</div>
        <div className="flex flex-wrap gap-2">
          {quickReplies.map((reply, index) => (
            <button
              key={index}
              onClick={() => handleQuickReply(reply)}
              className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input Area */}
      <div className="flex items-end space-x-3">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            className="w-full resize-none border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isSending}
          />
          
          {/* Character counter */}
          <div className="absolute bottom-1 right-2 text-xs text-muted-foreground">
            {message.length}/1000
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Status Indicators */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          {isSending && (
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span>Communicating with server...</span>
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <span>✅ Agent Active</span>
          <span>📞 WhatsApp Connected</span>
        </div>
      </div>
    </div>
  );
}; 