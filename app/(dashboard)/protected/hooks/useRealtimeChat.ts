'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/database/supabase/client';

type UseRealtimeChatProps = {
  userBusinessId: string | null;
  isSuperAdmin?: boolean;
  selectedUserId?: string;
  onMessagesUpdate: (channelUserId: string) => void;
  onConversationsUpdate: () => void;
  onChatStatusUpdate: () => void;
  onNotificationsUpdate?: () => void;
};

export function useRealtimeChat({
  userBusinessId,
  isSuperAdmin = false,
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
      if (!document.hidden && (userBusinessId || isSuperAdmin) && channelRef.current?.state !== 'joined') {
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
            if ((userBusinessId || isSuperAdmin) && !channelRef.current) {
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
  }, [userBusinessId, isSuperAdmin, supabase]);

  useEffect(() => {
    // Determine the subscription configuration based on user role
    let channelName: string | null = null;
    let eventsFilter: string | undefined = undefined;

    if (isSuperAdmin) {
      // Superadmins listen to all business updates on a global channel
      channelName = 'superadmin-all-updates';
      // No filter needed, they see everything
      eventsFilter = undefined; 
      console.log('[Realtime] Setting up SUPERADMIN realtime subscriptions');

    } else if (userBusinessId) {
      // Regular users listen to a business-specific channel and filter
      channelName = `business-${userBusinessId}-updates`;
      eventsFilter = `businessId=eq.${userBusinessId}`;
      console.log('[Realtime] Setting up realtime subscriptions for business:', userBusinessId);

    } else {
      // If not superadmin and no businessId, we cannot subscribe.
      // Clean up any existing channel.
      if (channelRef.current) {
        console.log('[Realtime] User is not superadmin and has no Business ID, cleaning up existing channel.');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }
    
    // Prevent multiple simultaneous connections
    if (channelRef.current?.state === 'joined' && channelRef.current.topic === channelName) {
      console.log('[Realtime] Connection already established for this channel, skipping...');
      return;
    }

    // If channel exists but is for a different user type/business, remove it first
    if (channelRef.current) {
      console.log('[Realtime] Channel configuration changed, removing old channel.');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    isConnectingRef.current = true;

    // Build the postgres_changes event filter
    const chatSessionsFilter: any = {
      event: '*',
      schema: 'public',
      table: 'chatSessions',
    };
    if (eventsFilter) {
      chatSessionsFilter.filter = eventsFilter;
    }

    const notificationsFilter: any = {
      schema: 'public',
      table: 'notifications',
    };
    if (eventsFilter) {
      notificationsFilter.filter = eventsFilter;
    }

    // Create a single channel for all realtime updates
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', chatSessionsFilter, (payload) => {
          console.log('[Realtime] ChatSession change detected:', payload);
          const updatedSession = payload.new as any;
          
          if (updatedSession) {
            callbacksRef.current.onConversationsUpdate();
            
            if (selectedUserIdRef.current && updatedSession.channelUserId === selectedUserIdRef.current) {
              console.log('[Realtime] Updating messages for selected user:', selectedUserIdRef.current);
              callbacksRef.current.onMessagesUpdate(selectedUserIdRef.current);
            }
          }
      })
      .on(
        'postgres_changes',
        {
          ...notificationsFilter,
          event: 'INSERT',
        },
        (payload) => {
          console.log('[Realtime] New notification created:', payload);
          callbacksRef.current.onConversationsUpdate();
          callbacksRef.current.onNotificationsUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          ...notificationsFilter,
          event: 'UPDATE',
        },
        (payload) => {
          console.log('[Realtime] Notification updated:', payload);
          callbacksRef.current.onConversationsUpdate();
          callbacksRef.current.onNotificationsUpdate();
          
          if (selectedUserIdRef.current) {
            callbacksRef.current.onChatStatusUpdate();
          }
        }
      );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log(`[Realtime] Channel [${channelName}] subscription status:`, status);
      
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Successfully subscribed to channel: ${channelName}`);
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
        console.warn(`[Realtime] Connection lost for channel [${channelName}] - Reason:`, errorMessage);
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
        console.warn(`[Realtime] Channel subscription timed out for channel: ${channelName}`);
        isConnectingRef.current = false;
      } else if (status === 'CLOSED') {
        console.log(`[Realtime] Channel subscription closed for channel: ${channelName}`);
        isConnectingRef.current = false;
      }
    });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelName) {
        console.log(`[Realtime] Cleaning up realtime subscriptions for channel: ${channelName}`);
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
      }
    };
  }, [userBusinessId, isSuperAdmin]); // Depend on both userBusinessId and isSuperAdmin

  return {
    isConnected: channelRef.current?.state === 'joined',
  };
} 