'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/database/supabase/client';
import { getChatSessions, getChatSessionDetails, getUserContext } from './actions';
import { NotificationBell } from './components/NotificationBell';
import { EscalationControls } from './components/EscalationControls';
import { AdminChatInput } from './components/AdminChatInput';
import { UserContextDBSchema } from '@/lib/database/models/user-context';
import { ChatSessionDBSchema } from '@/lib/database/models/chat-session';

interface AdminClientPageProps {
    initialSessions: ChatSessionDBSchema[];
    businessId: string;
    adminId: string;
}

interface Notification {
    id: string;
    message: string;
    status: 'unread' | 'read';
    chatSessionId: string;
}

export default function AdminClientPage({ initialSessions, businessId, adminId }: AdminClientPageProps) {
    const [sessions, setSessions] = useState<ChatSessionDBSchema[]>(initialSessions);
    const [selectedSession, setSelectedSession] = useState<ChatSessionDBSchema | null>(null);
    const [userContext, setUserContext] = useState<UserContextDBSchema | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const supabase = createClient();

    useEffect(() => {
        fetchNotifications();

        const channel = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `businessId=eq.${businessId}` },
                (payload) => {
                    setNotifications(prev => [payload.new as Notification, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [businessId, supabase]);
    
    useEffect(() => {
        if (!selectedSession) return;
        
        const fetchUserContext = async () => {
            const context = await getUserContext(selectedSession.channelUserId);
            setUserContext(context);
        };

        fetchUserContext();
        
        const messageChannel = supabase
            .channel(`session-${selectedSession.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'chatSessions', filter: `id=eq.${selectedSession.id}` },
                (payload) => {
                    setSelectedSession(payload.new as ChatSessionDBSchema);
                }
            )
            .subscribe();
            
        return () => {
            supabase.removeChannel(messageChannel);
        };

    }, [selectedSession, supabase]);

    const fetchNotifications = async () => {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('businessId', businessId)
            .order('createdAt', { ascending: false });
        setNotifications(data as Notification[] || []);
    };

    const handleSessionSelect = async (sessionId: string) => {
        const sessionDetails = await getChatSessionDetails(sessionId);
        setSelectedSession(sessionDetails);
    };

    const handleNotificationClick = async (notification: Notification) => {
        await handleSessionSelect(notification.chatSessionId);
        await supabase.from('notifications').update({ status: 'read' }).eq('id', notification.id);
        fetchNotifications(); 
    };

    return (
        <div className="flex h-screen bg-muted/40">
            {/* Session List */}
            <div className="w-1/4 border-r p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Conversations</h2>
                    <NotificationBell notifications={notifications} onNotificationClick={handleNotificationClick} />
                </div>
                <ul>
                    {sessions.map((session: ChatSessionDBSchema) => (
                        <li key={session.id} onClick={() => handleSessionSelect(session.id)} className="cursor-pointer p-2 hover:bg-muted rounded">
                            <p className="font-semibold">{session.channelUserId}</p>
                            <p className="text-sm text-muted-foreground truncate">{session.allMessages[session.allMessages.length - 1]?.content}</p>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Chat View */}
            <div className="flex-1 flex flex-col">
                {selectedSession && userContext ? (
                    <>
                        <div className="p-4 border-b">
                            <h3 className="text-lg font-semibold">{selectedSession.channelUserId}</h3>
                            <EscalationControls chatSession={selectedSession} userContext={userContext} />
                        </div>

                        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            {selectedSession.allMessages.map((msg, index) => (
                                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`px-4 py-2 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                                        <p>{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <AdminChatInput chatSession={selectedSession} userContext={userContext} adminId={adminId} />
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Select a conversation to start</p>
                    </div>
                )}
            </div>
        </div>
    );
} 