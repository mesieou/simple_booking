import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';

/**
 * Normalize a phone number for comparison by stripping non-digits.
 */
function normalize(number: string): string {
  return number.replace(/[^0-9]/g, '');
}

/**
 * Delete a user record based on their WhatsApp number.
 */
export async function deleteUserByWhatsapp(number: string): Promise<void> {
  const supa = getEnvironmentServiceRoleClient();
  const normalized = normalize(number);
  
  // First, get the user to find their auth ID
  const { data: user } = await supa
    .from('users')
    .select('id')
    .eq('whatsAppNumberNormalized', normalized)
    .single();
  
  // Delete from users table (profiles)
  await supa.from('users').delete().eq('whatsAppNumberNormalized', normalized);
  
  // Delete from auth.users table if user exists
  if (user?.id) {
    await supa.auth.admin.deleteUser(user.id);
  }
}

/**
 * Delete all chat sessions associated with a WhatsApp user.
 */
export async function deleteChatSessionsForUser(number: string): Promise<void> {
  const supa = getEnvironmentServiceRoleClient();
  const normalized = normalize(number);
  await supa
    .from('chatSessions')
    .delete()
    .eq('channel', 'whatsapp')
    .eq('channelUserId', normalized);
}
