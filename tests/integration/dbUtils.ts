import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';

/**
 * Normalize a phone number for comparison by stripping non-digits.
 */
function normalize(number: string): string {
  return number.replace(/[^0-9]/g, '');
}

/**
 * Delete all chat sessions associated with a WhatsApp user.
 * This only cleans up temporary session data, never deletes actual users.
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
