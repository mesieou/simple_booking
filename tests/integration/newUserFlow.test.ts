import { deleteUserByWhatsapp, deleteChatSessionsForUser } from './dbUtils';

const TEST_WHATSAPP_NUMBER = '+15555550123';

beforeAll(async () => {
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
  });
});
