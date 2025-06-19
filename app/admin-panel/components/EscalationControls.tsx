'use client';

import { Button } from '@/components/ui/button';
import { takeControlOfChat, resolveChat } from '../actions';
import { UserContextDBSchema } from '@/lib/database/models/user-context';
import { ChatSessionDBSchema } from '@/lib/database/models/chat-session';

interface EscalationControlsProps {
    chatSession: ChatSessionDBSchema;
    userContext: UserContextDBSchema | null;
}

export function EscalationControls({ chatSession, userContext }: EscalationControlsProps) {
    const dialogueState = userContext?.currentGoal?.collectedData?.dialogueState;
    const escalationStatus = dialogueState?.escalationStatus;

    const handleTakeControl = async () => {
        if (chatSession?.id) {
            await takeControlOfChat(chatSession.id);
        }
    };

    const handleResolve = async () => {
        if (chatSession?.id) {
            await resolveChat(chatSession.id);
        }
    };

    if (escalationStatus === 'pending_human') {
        return (
            <Button onClick={handleTakeControl} className="w-full">
                Take Control of Chat
            </Button>
        );
    }

    if (escalationStatus === 'in_progress_human') {
        return (
            <Button onClick={handleResolve} variant="destructive" className="w-full">
                Mark as Resolved & Return to Bot
            </Button>
        );
    }

    return null;
} 