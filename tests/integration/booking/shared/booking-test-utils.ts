import { simulateWebhookPost } from '../../utils';
import { ChatSession } from '@/lib/database/models/chat-session';
import { UserContext } from '@/lib/database/models/user-context';
import { Service } from '@/lib/database/models/service';
import { deleteChatSessionsForUser, deleteUserByWhatsapp } from '../../dbUtils';
import { TEST_CONFIG, getNormalizedTestPhone } from '../../../config/test-config';
import { BOT_CONFIG } from "@/lib/bot-engine/types";

export const TEST_PHONE = TEST_CONFIG.TEST_PHONE_NUMBER;
export const BUSINESS_ID = TEST_CONFIG.BUSINESS_ID;

export async function cleanup() {
  await deleteChatSessionsForUser(TEST_PHONE);
  await deleteUserByWhatsapp(TEST_PHONE);
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    getNormalizedTestPhone(),
    BUSINESS_ID
  );
  if (ctx) await UserContext.delete(ctx.id);
}

export async function startBookingFlow() {
  const resp = await simulateWebhookPost({ phone: TEST_PHONE, message: 'start_booking_flow' });
  expect(JSON.stringify(resp)).toMatch(/success/i);
}

export async function getActiveSession() {
  return await ChatSession.getActiveByChannelUserId(
    'whatsapp',
    getNormalizedTestPhone(),
    BOT_CONFIG.SESSION_TIMEOUT_HOURS
  );
}

export async function fetchServices() {
  const services = await Service.getByBusiness(BUSINESS_ID);
  expect(services.length).toBeGreaterThan(0);
  return services;
}