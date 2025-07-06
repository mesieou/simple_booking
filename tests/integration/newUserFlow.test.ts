import { simulateWebhookPost } from './utils';
import { User } from '@/lib/database/models/user';
import { ChatSession } from '@/lib/database/models/chat-session';
import { UserContext } from '@/lib/database/models/user-context';
import { BOT_CONFIG } from '@/lib/bot-engine/types';

// === integration tests ===
import {
  deleteUserByWhatsapp,
  deleteChatSessionsForUser,
  ensureTestBusinessExists
} from './dbUtils';

const TEST_WHATSAPP_NUMBER = '+15555550123';

beforeAll(async () => {
  await ensureTestBusinessExists();
  await deleteChatSessionsForUser(TEST_WHATSAPP_NUMBER);
  await deleteUserByWhatsapp(TEST_WHATSAPP_NUMBER);
});

afterAll(async () => {
  await deleteChatSessionsForUser(TEST_WHATSAPP_NUMBER);
  await deleteUserByWhatsapp(TEST_WHATSAPP_NUMBER);
});

describe('New user flow', () => {
  it('placeholder test', async () => {
    expect(true).toBe(true);
// ===

describe('WhatsApp new user flow', () => {
  const phone = '+19998887777';
  let businessId: string | undefined;

  beforeAll(async () => {
    const existing = await User.findUserByCustomerWhatsappNumber(phone);
    if (existing) {
      await User.delete(existing.id);
    }
  });

  afterAll(async () => {
    const user = await User.findUserByCustomerWhatsappNumber(phone);
    if (user) {
      await User.delete(user.id);
    }
    if (businessId) {
      const sessions = await ChatSession.getAll();
      for (const s of sessions) {
        if (s.channelUserId === phone.replace(/[^\d]/g, '')) {
          await ChatSession.delete(s.id);
        }
      }
      const ctx = await UserContext.getByChannelUserIdAndBusinessId(phone.replace(/[^\d]/g, ''), businessId);
      if (ctx) await UserContext.delete(ctx.id);
    }
  });

  it('creates user after collecting name', async () => {
    const firstResp = await simulateWebhookPost({ phone, message: 'Hola' });
    expect(JSON.stringify(firstResp)).toMatch(/nombre|llamas/i);

    const session = await ChatSession.getActiveByChannelUserId('whatsapp', phone.replace(/[^\d]/g, ''), BOT_CONFIG.SESSION_TIMEOUT_HOURS);
    expect(session).not.toBeNull();
    if (session) {
      businessId = session.businessId;
      const ctx = await UserContext.getByChannelUserIdAndBusinessId(phone.replace(/[^\d]/g, ''), session.businessId);
      expect(ctx?.sessionData?.awaitingName).toBe(true);
    }

    const secondResp = await simulateWebhookPost({ phone, message: 'TestLukitas' });
    expect(JSON.stringify(secondResp)).toMatch(/TestLukitas/);

    const created = await User.findUserByCustomerWhatsappNumber(phone);
    expect(created).not.toBeNull();
    expect(created?.firstName).toBe('TestLukitas');
  });
});
