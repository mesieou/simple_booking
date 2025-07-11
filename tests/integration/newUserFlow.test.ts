import { simulateWebhookPost } from './utils';
import { User } from '@/lib/database/models/user';
import { ChatSession } from '@/lib/database/models/chat-session';
import { UserContext } from '@/lib/database/models/user-context';
import { BOT_CONFIG } from '@/lib/bot-engine/types';
import { deleteChatSessionsForUser } from './dbUtils';
import { ESCALATION_TEST_CONFIG, getNormalizedPhone } from '../config/escalation-test-config';

const TEST_PHONE = ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE.replace(/^\+/, ''); // Remove + for webhook simulation
const BUSINESS_ID = ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID;
const TEST_USER_NAME = ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[0]; // Use first name

/**
 * Helper function to get normalized phone number
 */
function getNormalizedTestPhone(): string {
  return getNormalizedPhone(ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE);
}

/**
 * Clean up test data - only removes temporary sessions and contexts, never users
 */
async function cleanup() {
  await deleteChatSessionsForUser(TEST_PHONE);
  
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    getNormalizedTestPhone(),
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
    expect(JSON.stringify(firstResp)).toMatch(/success/i);

    const session = await ChatSession.getActiveByChannelUserId(
      'whatsapp',
      getNormalizedTestPhone(),
      BOT_CONFIG.SESSION_TIMEOUT_HOURS
    );
    expect(session).not.toBeNull();
    expect(session?.businessId).toBe(BUSINESS_ID);
    if (session) {
      const ctx = await UserContext.getByChannelUserIdAndBusinessId(
        getNormalizedTestPhone(),
        session.businessId
      );
      expect(ctx?.sessionData?.awaitingName).toBe(true);
      
      // Verify the bot actually asked for the name
      const messages = session.allMessages;
      expect(messages).toHaveLength(2); // user message + bot response
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hola');
      expect(messages[1].role).toBe('bot');
      
      // Bot response can be either string or object with text property
      const botContent = typeof messages[1].content === 'string' 
        ? messages[1].content 
        : (messages[1].content as any)?.text || '';
      expect(botContent).toMatch(/name|What's your name/i);
    }

    const secondResp = await simulateWebhookPost({ phone: TEST_PHONE, message: TEST_USER_NAME });
    expect(JSON.stringify(secondResp)).toMatch(/success/i);

    const created = await User.findUserByCustomerWhatsappNumber(TEST_PHONE);
    expect(created).not.toBeNull();
    expect(created?.firstName).toBe(TEST_USER_NAME);
    
    // Verify the session was updated with the name collection
    const updatedSession = await ChatSession.getActiveByChannelUserId(
      'whatsapp',
      getNormalizedTestPhone(),
      BOT_CONFIG.SESSION_TIMEOUT_HOURS
    );
    if (updatedSession) {
      const finalMessages = updatedSession.allMessages;
      expect(finalMessages.length).toBeGreaterThanOrEqual(4); // original + name exchange + final response
      // Find the user message with the name
      const nameMessage = finalMessages.find(msg => msg.role === 'user' && msg.content === TEST_USER_NAME);
      expect(nameMessage).toBeDefined();
    }
  }, ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000); // Convert to milliseconds
});
