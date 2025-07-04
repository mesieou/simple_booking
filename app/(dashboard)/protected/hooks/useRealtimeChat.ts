'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/database/supabase/client';

type UseRealtimeChatProps = {
  userBusinessId: string | null;
  selectedUserId?: string;
  onMessagesUpdate: (channelUserId: string) => void;
  onConversationsUpdate: () => void;
  onChatStatusUpdate: () => void;
  onNotificationsUpdate?: () => void;
};

export function useRealtimeChat({
  userBusinessId,
  selectedUserId,
  onMessagesUpdate,
  onConversationsUpdate,
  onChatStatusUpdate,
  onNotificationsUpdate,
}: UseRealtimeChatProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selectedUserIdRef = useRef<string | undefined>(selectedUserId);
  const supabase = createClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  // Update the ref whenever selectedUserId changes
  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  // Use refs to avoid stale closures while preventing unnecessary reconnections
  const callbacksRef = useRef({
    onMessagesUpdate,
    onConversationsUpdate,
    onChatStatusUpdate,
    onNotificationsUpdate: onNotificationsUpdate || (() => {}),
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onMessagesUpdate,
      onConversationsUpdate,
      onChatStatusUpdate,
      onNotificationsUpdate: onNotificationsUpdate || (() => {}),
    };
  }, [onMessagesUpdate, onConversationsUpdate, onChatStatusUpdate, onNotificationsUpdate]);

  // Handle page visibility changes - reconnect when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userBusinessId && channelRef.current?.state !== 'joined') {
        console.log('[Realtime] Page became visible - checking connection status');
        
        // Force reconnection if not connected
        if (channelRef.current && channelRef.current.state === 'closed') {
          console.log('[Realtime] Forcing reconnection after page visibility change');
          
          // Clean up old channel
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
          
          // Reset flags
          isConnectingRef.current = false;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          
          // Trigger reconnection (useEffect will handle it)
          setTimeout(() => {
            if (userBusinessId && !channelRef.current) {
              window.location.reload();
            }
          }, 1000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userBusinessId, supabase]);

  useEffect(() => {
    // Wait until we have a valid business ID before subscribing
    if (!userBusinessId) {
      // If there's an active channel, clean it up
      if (channelRef.current) {
        console.log('[Realtime] Business ID is null, cleaning up existing channel.');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }
    
    // Prevent multiple simultaneous connections
    if (channelRef.current?.state === 'joined') {
      console.log('[Realtime] Connection already established, skipping...');
      return;
    }

    console.log('[Realtime] Setting up realtime subscriptions for business:', userBusinessId);
    isConnectingRef.current = true;

    // Create a single channel for all realtime updates
    const channel = supabase
      .channel(`business-${userBusinessId}-updates`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chatSessions',
          filter: `businessId=eq.${userBusinessId}`
        },
        (payload) => {
          console.log('[Realtime] ChatSession change detected (any event):', payload);
          const updatedSession = payload.new as any;
          
          // Always update conversations list to show latest activity
          callbacksRef.current.onConversationsUpdate();
          
          // If this is the currently selected user's session, update messages
          // Use ref to get the current selectedUserId value
          if (selectedUserIdRef.current && updatedSession.channelUserId === selectedUserIdRef.current) {
            console.log('[Realtime] Updating messages for selected user:', selectedUserIdRef.current);
            callbacksRef.current.onMessagesUpdate(selectedUserIdRef.current);
          }
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
          callbacksRef.current.onConversationsUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `businessId=eq.${userBusinessId}`
        },
        (payload) => {
          console.log('[Realtime] New notification created:', payload);
          // New escalation notification - only refresh conversations and notifications panel
          // Chat status will be updated when user selects the conversation
          callbacksRef.current.onConversationsUpdate();
          callbacksRef.current.onNotificationsUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `businessId=eq.${userBusinessId}`
        },
        (payload) => {
          console.log('[Realtime] Notification updated:', payload);
          const updatedNotification = payload.new as any;
          
          // Notification status changed (pending -> attending, etc)
          callbacksRef.current.onConversationsUpdate(); // Update conversation highlights
          callbacksRef.current.onNotificationsUpdate(); // Update notification panel
          
          // Only update chat status if this notification is for the currently selected session
          if (selectedUserIdRef.current) {
            callbacksRef.current.onChatStatusUpdate();
          }
        }
      );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('[Realtime] Channel subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Successfully subscribed to realtime updates for business:', userBusinessId);
        isConnectingRef.current = false;
        
        // Reset retry counter on successful connection
        if (channelRef.current) {
          (channelRef.current as any)._retryCount = 0;
        }
        
        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      } else if (status === 'CHANNEL_ERROR') {
        // Better error handling - only log error if it exists  
        const errorMessage = err ? err.toString() : 'Network disconnection';
        console.warn('[Realtime] Connection lost for business:', userBusinessId, '- Reason:', errorMessage);
        isConnectingRef.current = false;
        
        // Implement retry logic with exponential backoff and max retries
        if (!reconnectTimeoutRef.current) {
          const retryCount = (channelRef.current as any)?._retryCount || 0;
          const maxRetries = 3;
          
          if (retryCount >= maxRetries) {
            console.log(`[Realtime] Max retry attempts (${maxRetries}) reached. Stopping reconnection attempts.`);
            return;
          }
          
          const retryDelay = Math.min(3000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
          console.log(`[Realtime] Attempting to reconnect in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[Realtime] Retrying connection...');
            reconnectTimeoutRef.current = null;
            
            if (channelRef.current) {
              (channelRef.current as any)._retryCount = retryCount + 1;
            }
            
            // The useEffect will handle reconnection when dependencies change
          }, retryDelay);
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('[Realtime] Channel subscription timed out for business:', userBusinessId);
        isConnectingRef.current = false;
      } else if (status === 'CLOSED') {
        console.log('[Realtime] Channel subscription closed for business:', userBusinessId);
        isConnectingRef.current = false;
      }
    });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log('[Realtime] Cleaning up realtime subscriptions for business:', userBusinessId);
      isConnectingRef.current = false;
      
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (channelRef.current) {
        try {
          const channelToRemove = channelRef.current;
          channelRef.current = null; // Set to null first to prevent race conditions
          
          supabase.removeChannel(channelToRemove);
          console.log('[Realtime] Successfully removed channel');
        } catch (err) {
          console.error('[Realtime] Error removing channel:', err);
        }
      }
    };
  }, [userBusinessId]); // Only depend on userBusinessId since callbacks are now in refs

  return {
    isConnected: channelRef.current?.state === 'joined',
  };
} 