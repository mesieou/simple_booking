'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/database/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type UseRealtimeChatProps = {
  userBusinessId?: string;
  selectedUserId?: string;
  onMessagesUpdate: (channelUserId: string) => void;
  onConversationsUpdate: () => void;
  onChatStatusUpdate: () => void;
};

export function useRealtimeChat({
  userBusinessId,
  selectedUserId,
  onMessagesUpdate,
  onConversationsUpdate,
  onChatStatusUpdate,
}: UseRealtimeChatProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!userBusinessId) return;

    console.log('[Realtime] Setting up realtime subscriptions for business:', userBusinessId);

    // Create a single channel for all realtime updates
    const channel = supabase
      .channel(`business-${userBusinessId}-updates`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chatSessions',
          filter: `businessId=eq.${userBusinessId}`
        },
        (payload) => {
          console.log('[Realtime] ChatSession updated:', payload);
          const updatedSession = payload.new as any;
          
          // If this is the currently selected user's session, update messages
          if (selectedUserId && updatedSession.channelUserId === selectedUserId) {
            console.log('[Realtime] Updating messages for selected user:', selectedUserId);
            onMessagesUpdate(selectedUserId);
          }
          
          // Always update conversations list to show latest activity
          onConversationsUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chatSessions',
          filter: `businessId=eq.${userBusinessId}`
        },
        (payload) => {
          console.log('[Realtime] New ChatSession created:', payload);
          // New conversation - update the conversations list
          onConversationsUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          console.log('[Realtime] New notification created:', payload);
          // New escalation notification - trigger chat status refresh
          onChatStatusUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          console.log('[Realtime] Notification updated:', payload);
          // Notification status changed (pending -> attending, etc)
          onChatStatusUpdate();
        }
      );

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('[Realtime] Channel subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Successfully subscribed to realtime updates');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel subscription error');
      }
    });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log('[Realtime] Cleaning up realtime subscriptions');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userBusinessId, selectedUserId, onMessagesUpdate, onConversationsUpdate, onChatStatusUpdate]);

  return {
    isConnected: channelRef.current?.state === 'joined',
  };
} 