'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sendAdminMessage } from '../actions';
import { useState, ChangeEvent } from 'react';
import { ChatSessionDBSchema } from '@/lib/database/models/chat-session';
import { UserContextDBSchema } from '@/lib/database/models/user-context';

interface AdminChatInputProps {
    chatSession: ChatSessionDBSchema;
    userContext: UserContextDBSchema | null;
    adminId: string;
}

export function AdminChatInput({ chatSession, userContext, adminId }: AdminChatInputProps) {
    const [message, setMessage] = useState('');

    const dialogueState = userContext?.currentGoal?.collectedData?.dialogueState;
    const isEscalated = dialogueState?.escalationStatus === 'in_progress_human';

    const handleSendMessage = async () => {
        if (!message.trim() || !isEscalated) return;
        
        await sendAdminMessage(
            chatSession.id,
            message,
            chatSession.channelUserId,
            adminId
        );
        setMessage('');
    };

    return (
        <div className="p-4 border-t">
            <div className="relative">
                <Textarea
                    placeholder={isEscalated ? "Type your message as an admin..." : "Chat is handled by the bot. Take control to send messages."}
                    value={message}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                    disabled={!isEscalated}
                    className="pr-16"
                />
                <Button
                    type="submit"
                    size="icon"
                    className="absolute top-1/2 right-3 -translate-y-1/2"
                    onClick={handleSendMessage}
                    disabled={!isEscalated || !message.trim()}
                >
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
} 