import AdminClientPage from './client-page';
import { getChatSessions } from './actions';

export default async function AdminPanel() {
  // As requested, the businessId is hardcoded for now.
  // In a real application, this would come from the logged-in user's session.
  const businessId = '228c7e8e-ec15-4eeb-a766-d1ebee07104f';
  const adminId = 'admin-user-123'; // Placeholder for admin user
  
  const initialSessions = await getChatSessions(businessId);
  
  return <AdminClientPage 
    initialSessions={initialSessions} 
    businessId={businessId}
    adminId={adminId} 
  />;
} 