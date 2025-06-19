'use client';

interface CustomerInfo {
  customerName: string;
  customerPhone: string;
}

interface UserInfoProps {
  customer: CustomerInfo;
}

export const UserInfo = ({ customer }: UserInfoProps) => {

  const status = 'active'; // Placeholder
  const totalBookings = 0; // Placeholder

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vip':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'active':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'new':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="p-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-lg">
              {customer.customerName.charAt(0)}
            </span>
          </div>
          
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-foreground">{customer.customerName}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(status)}`}>
                {status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>📱 {customer.customerPhone}</span>
              {/* Placeholders for email and location */}
              <span>✉️ not-available@email.com</span>
              <span>📍 Unknown Location</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm text-muted-foreground">Total Bookings</div>
          <div className="text-2xl font-bold text-primary">{totalBookings}</div>
        </div>
      </div>

      <div className="mt-3 flex space-x-2">
        <button className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors">
          View Profile
        </button>
        <button className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors">
          Booking History
        </button>
        <button className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors">
          Send Template
        </button>
      </div>
    </div>
  );
}; 