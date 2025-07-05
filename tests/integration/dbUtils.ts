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

/**
 * Ensure a test business exists for integration tests.
 * Inserts a minimal WhatsApp business with a fixed ID if not present.
 */
export async function ensureTestBusinessExists(): Promise<void> {
  const supa = getEnvironmentServiceRoleClient();
  const businessId = 'test-biz';
  const whatsappNumber = '+15551890570';
  const phoneNumberId = '15551890570';

  const { data: existing } = await supa
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .maybeSingle();

  if (!existing) {
    await supa.from('businesses').insert({
      id: businessId,
      name: 'Test Business',
      email: 'test@example.com',
      phone: whatsappNumber,
      timeZone: 'UTC',
      interfaceType: 'whatsapp',
      whatsappNumber,
      whatsappPhoneNumberId: phoneNumberId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}
