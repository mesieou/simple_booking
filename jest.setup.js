const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });

// Increase timeout for async operations
jest.setTimeout(120000); // 2 minutes for API-dependent tests

// Mock WhatsApp sender for tests
jest.mock('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender', () => {
  return {
    WhatsappSender: jest.fn().mockImplementation(() => ({
      sendMessage: jest.fn().mockResolvedValue('mock-message-id-123'),
      sendTemplateMessage: jest.fn().mockResolvedValue('mock-template-id-456'),
      sendToWhatsappApi: jest.fn().mockResolvedValue({ message_id: 'mock-api-id-789' }),
      getApiUrl: jest.fn().mockReturnValue('https://mock-api-url.com')
    }))
  };
});

// Clean up after all tests
afterAll(async () => {
  // Give a small delay to ensure all async operations complete
  await new Promise(resolve => setTimeout(resolve, 1000));
}); 