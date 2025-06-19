'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
    id: string;
    message: string;
    status: 'unread' | 'read';
    chatSessionId: string;
}

interface NotificationBellProps {
    notifications: Notification[];
    onNotificationClick: (notification: Notification) => Promise<void>;
}

export function NotificationBell({ notifications, onNotificationClick }: NotificationBellProps) {
  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {notifications.length === 0 ? (
            <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
          ) : (
            notifications.map(notification => (
              <DropdownMenuItem
                key={notification.id}
                onClick={async () => await onNotificationClick(notification)}
                className={notification.status === 'unread' ? 'font-bold' : ''}
              >
                <p className="text-sm">{notification.message}</p>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
} 