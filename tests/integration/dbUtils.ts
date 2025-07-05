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
  await supa.from('users').delete().eq('whatsAppNumberNormalized', normalized);
}

/**
 * Delete all chat sessions associated with a WhatsApp user.
 */
export async function deleteChatSessionsForUser(number: string): Promise<void> {
  const supa = getEnvironmentServiceRoleClient();
  await supa
    .from('chatSessions')
    .delete()
    .eq('channel', 'whatsapp')
    .eq('channelUserId', number);
}
