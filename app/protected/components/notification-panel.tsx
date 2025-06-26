'use client';

import { useState, useEffect } from "react";
import { getDashboardNotifications, markNotificationAsRead } from "../../actions";

type DashboardNotification = {
  id: string;
  createdAt: string;
  message: string;
  status: string;
  chatSessionId: string;
  channelUserId: string;
};

type NotificationPanelProps = {
  onNotificationClick: (channelUserId: string, sessionId: string) => void;
  refreshTrigger?: number;
};

export function NotificationPanel({ onNotificationClick, refreshTrigger }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  // Load read notifications from localStorage on mount
  useEffect(() => {
    const savedReadNotifications = localStorage.getItem('readNotifications');
    if (savedReadNotifications) {
      try {
        const parsed = JSON.parse(savedReadNotifications);
        setReadNotifications(new Set(parsed));
      } catch (error) {
        console.error('Error loading read notifications from localStorage:', error);
      }
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const fetchedNotifications = await getDashboardNotifications();
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Refresh when triggered by realtime updates
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      console.log('[NotificationPanel] Refresh triggered by realtime update');
      fetchNotifications();
    }
  }, [refreshTrigger]);

  const handleNotificationClick = async (notification: DashboardNotification) => {
    // Mark as read
    if (!readNotifications.has(notification.id)) {
      const newReadNotifications = new Set(readNotifications);
      newReadNotifications.add(notification.id);
      setReadNotifications(newReadNotifications);
      
      // Save to localStorage
      localStorage.setItem('readNotifications', JSON.stringify(Array.from(newReadNotifications)));
      
      // Call the backend (for future implementation)
      try {
        await markNotificationAsRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate to the chat
    onNotificationClick(notification.channelUserId, notification.chatSessionId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⚠️';
      case 'attending':
        return '🔃';
      case 'provided_help':
        return '✅';
      case 'ignored':
        return '❌';
      case 'wrong_activation':
        return '🔄';
      default:
        return '📢';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/20';
      case 'attending':
        return 'text-blue-400 bg-blue-400/20';
      case 'provided_help':
        return 'text-green-400 bg-green-400/20';
      case 'ignored':
        return 'text-gray-400 bg-gray-400/20';
      case 'wrong_activation':
        return 'text-orange-400 bg-orange-400/20';
      default:
        return 'text-purple-400 bg-purple-400/20';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full max-h-full overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <h3 className="text-base font-semibold text-white whitespace-nowrap">📢 Notifications</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-sm">Loading notifications...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-h-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-white/10 flex-shrink-0">
        <h3 className="text-base font-semibold text-white flex items-center gap-1 whitespace-nowrap">
          📢 <span className="flex-shrink-0">Notifications</span>
          {notifications.length > 0 && (
            <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded-full flex-shrink-0 ml-1">
              {notifications.filter(n => !readNotifications.has(n.id)).length} new
            </span>
          )}
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs mt-1">Escalation alerts will appear here</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {notifications.map((notification) => {
              const isRead = readNotifications.has(notification.id);
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`relative p-3 rounded-lg cursor-pointer transition-all duration-200 border border-transparent hover:border-white/20 hover:bg-slate-700/50 ${
                    isRead 
                      ? 'opacity-50 bg-slate-800/30' 
                      : 'bg-slate-800/60 hover:bg-slate-700/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">
                      {getStatusIcon(notification.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium truncate">
                          {notification.channelUserId}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(notification.status)}`}>
                          {notification.status}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                        {notification.message}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {new Date(notification.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  {!isRead && (
                    <div className="w-2 h-2 bg-blue-400 rounded-full absolute top-2 right-2"></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 