'use client';

interface Notification {
  id: string;
  type: 'escalation' | 'urgent' | 'info';
  title: string;
  message: string;
  timestamp: string;
  chatId?: string;
  customerName?: string;
  isRead: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'escalation',
    title: 'New Escalation',
    message: 'Customer Maria Rodriguez requested human assistance for payment issue',
    timestamp: '2 min ago',
    chatId: '1',
    customerName: 'Maria Rodriguez',
    isRead: false
  },
  {
    id: '2',
    type: 'escalation',
    title: 'Escalation Request',
    message: 'Ana Garcia needs help with appointment rescheduling',
    timestamp: '1 hour ago',
    chatId: '3',
    customerName: 'Ana Garcia',
    isRead: false
  },
  {
    id: '3',
    type: 'urgent',
    title: 'System Alert',
    message: 'WhatsApp API rate limit approaching',
    timestamp: '30 min ago',
    isRead: true
  },
  {
    id: '4',
    type: 'info',
    title: 'Chat Resolved',
    message: 'John Smith escalation was successfully closed',
    timestamp: '2 hours ago',
    chatId: '2',
    customerName: 'John Smith',
    isRead: true
  }
];

export const NotificationPanel = () => {
  const handleNotificationClick = (notification: Notification) => {
    if (notification.chatId) {
      // TODO: Navigate to specific chat
      console.log('Navigating to chat:', notification.chatId);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'escalation':
        return '🚨';
      case 'urgent':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  const getNotificationStyle = (type: Notification['type'], isRead: boolean) => {
    const baseStyle = 'p-3 border-b border-border cursor-pointer transition-colors';
    const readStyle = isRead ? 'opacity-70' : '';
    
    switch (type) {
      case 'escalation':
        return `${baseStyle} ${readStyle} hover:bg-destructive/10 ${!isRead ? 'bg-destructive/5 border-l-4 border-l-destructive' : ''}`;
      case 'urgent':
        return `${baseStyle} ${readStyle} hover:bg-yellow-500/10 ${!isRead ? 'bg-yellow-500/5 border-l-4 border-l-yellow-500' : ''}`;
      case 'info':
        return `${baseStyle} ${readStyle} hover:bg-blue-500/10 ${!isRead ? 'bg-blue-500/5 border-l-4 border-l-blue-500' : ''}`;
      default:
        return `${baseStyle} ${readStyle} hover:bg-accent/50`;
    }
  };

  const unreadCount = mockNotifications.filter(n => !n.isRead).length;
  const escalationCount = mockNotifications.filter(n => n.type === 'escalation' && !n.isRead).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-center p-2 bg-destructive/10 rounded">
            <div className="font-bold text-destructive">{escalationCount}</div>
            <div className="text-xs text-muted-foreground">Active Escalations</div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className="font-bold text-foreground">{mockNotifications.length}</div>
            <div className="text-xs text-muted-foreground">Total Today</div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {mockNotifications.map((notification) => (
          <div
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
            className={getNotificationStyle(notification.type, notification.isRead)}
          >
            {/* Notification Header */}
            <div className="flex items-start space-x-3">
              <span className="text-lg">{getNotificationIcon(notification.type)}</span>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {notification.title}
                  </h4>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 ml-2"></div>
                  )}
                </div>
                
                {/* Customer Name */}
                {notification.customerName && (
                  <p className="text-xs text-primary font-medium mb-1">
                    {notification.customerName}
                  </p>
                )}
                
                {/* Message */}
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {notification.message}
                </p>
                
                {/* Timestamp */}
                <p className="text-xs text-muted-foreground">
                  {notification.timestamp}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border bg-card space-y-2">
        <button className="w-full px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors">
          Mark All as Read
        </button>
        <button className="w-full px-3 py-2 text-sm bg-muted hover:bg-accent text-muted-foreground rounded transition-colors">
          Clear Notifications
        </button>
      </div>
    </div>
  );
}; 