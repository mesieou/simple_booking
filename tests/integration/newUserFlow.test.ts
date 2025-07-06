import { simulateWebhookPost } from './utils';
import { User } from '@/lib/database/models/user';
import { ChatSession } from '@/lib/database/models/chat-session';
import { UserContext } from '@/lib/database/models/user-context';
import { BOT_CONFIG } from '@/lib/bot-engine/types';
import { deleteUserByWhatsapp, deleteChatSessionsForUser } from './dbUtils';

const TEST_PHONE = '+19998887777';
const BUSINESS_ID = '7c98818f-2b01-4fa4-bbca-0d59922a50f7';

async function cleanup() {
  await deleteChatSessionsForUser(TEST_PHONE);
  await deleteUserByWhatsapp(TEST_PHONE);
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    TEST_PHONE.replace(/[^\d]/g, ''),
    BUSINESS_ID
  );
  if (ctx) await UserContext.delete(ctx.id);
}

describe('WhatsApp new user flow', () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('creates user after collecting name', async () => {
    const firstResp = await simulateWebhookPost({ phone: TEST_PHONE, message: 'Hola' });
    expect(JSON.stringify(firstResp)).toMatch(/nombre|llamas/i);

    const session = await ChatSession.getActiveByChannelUserId(
      'whatsapp',
      TEST_PHONE.replace(/[^\d]/g, ''),
      BOT_CONFIG.SESSION_TIMEOUT_HOURS
    );
    expect(session).not.toBeNull();
    expect(session?.businessId).toBe(BUSINESS_ID);
    if (session) {
      const ctx = await UserContext.getByChannelUserIdAndBusinessId(
        TEST_PHONE.replace(/[^\d]/g, ''),
        session.businessId
      );
      expect(ctx?.sessionData?.awaitingName).toBe(true);
    }

    const secondResp = await simulateWebhookPost({ phone: TEST_PHONE, message: 'TestLukitas' });
    expect(JSON.stringify(secondResp)).toMatch(/TestLukitas/);

    const created = await User.findUserByCustomerWhatsappNumber(TEST_PHONE);
    expect(created).not.toBeNull();
    expect(created?.firstName).toBe('TestLukitas');
  });
});
