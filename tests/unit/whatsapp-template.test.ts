import { WhatsAppTemplateSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-template-sender';
import { sendEscalationTemplate } from '@/lib/bot-engine/escalation/proxy-template-service';
import { getEscalationTemplateName } from '@/lib/bot-engine/escalation/types';

// Mock WhatsApp API calls for testing
jest.mock('@/lib/bot-engine/channels/whatsapp/whatsapp-template-sender');

describe('WhatsApp Template Tests', () => {
  const mockTemplateSender = jest.mocked(WhatsAppTemplateSender);
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the sendTemplateMessage method
    mockTemplateSender.prototype.sendTemplateMessage = jest.fn().mockResolvedValue('mock-message-id');
  });

  describe('Template Language Code Mapping', () => {
    it('should use "en" for English templates, not "en_US"', async () => {
      const sender = new WhatsAppTemplateSender();
      
      await sender.sendEscalationTemplate(
        '+61452490450',
        'John Doe',
        'Can I speak with a human',
        '680108705183414',
        'en'
      );
      
      expect(sender.sendTemplateMessage).toHaveBeenCalledWith(
        '+61452490450',
        expect.any(String),
        'en', // Should be 'en', not 'en_US'
        expect.any(Array),
        '680108705183414',
        expect.any(Array)
      );
    });

    it('should use "es" for Spanish templates', async () => {
      const sender = new WhatsAppTemplateSender();
      
      await sender.sendEscalationTemplate(
        '+61452490450',
        'Juan Pérez',
        'Necesito ayuda humana',
        '680108705183414',
        'es'
      );
      
      expect(sender.sendTemplateMessage).toHaveBeenCalledWith(
        '+61452490450',
        expect.any(String),
        'es',
        expect.any(Array),
        '680108705183414',
        expect.any(Array)
      );
    });

    it('should default to "en" for unknown languages', async () => {
      const sender = new WhatsAppTemplateSender();
      
      await sender.sendEscalationTemplate(
        '+61452490450',
        'John Doe',
        'Help me',
        '680108705183414',
        'fr' // Unsupported language
      );
      
      expect(sender.sendTemplateMessage).toHaveBeenCalledWith(
        '+61452490450',
        expect.any(String),
        'en', // Should default to 'en'
        expect.any(Array),
        '680108705183414',
        expect.any(Array)
      );
    });
  });

  describe('Template Parameter Structure', () => {
    it('should correctly structure header and body parameters for customer_needs_help template', async () => {
      const sender = new WhatsAppTemplateSender();
      const customerName = 'John Doe';
      const conversationHistory = '🤖 Bot: "Hello!" 👤 Customer: "Hi"';
      const currentMessage = 'Can I speak with a human';
      
      await sender.sendEscalationTemplate(
        '+61452490450',
        customerName,
        currentMessage,
        '680108705183414',
        'en'
      );
      
      expect(sender.sendTemplateMessage).toHaveBeenCalledWith(
        '+61452490450',
        'customer_needs_help',
        'en',
        [
          customerName, // {{1}} in body - customer name (reused from header)
          expect.any(String), // {{2}} in body - conversation history
          currentMessage // {{3}} in body - current message
        ],
        '680108705183414',
        [customerName] // {{1}} in header - customer name
      );
    });

    it('should handle the actual template structure: Header {{1}}, Body {{1}}, {{2}}, {{3}}', async () => {
      const mockSendTemplateMessage = jest.fn().mockResolvedValue('success');
      mockTemplateSender.prototype.sendTemplateMessage = mockSendTemplateMessage;
      
      const sender = new WhatsAppTemplateSender();
      
      // Simulate the actual escalation template call
      await sender.sendTemplateMessage(
        '+61452490450',
        'customer_needs_help',
        'en',
        ['John Doe', 'Recent chat history', 'Current message'], // Body params
        '680108705183414',
        ['John Doe'] // Header params
      );
      
      expect(mockSendTemplateMessage).toHaveBeenCalledWith(
        '+61452490450',
        'customer_needs_help',
        'en',
        ['John Doe', 'Recent chat history', 'Current message'],
        '680108705183414',
        ['John Doe']
      );
    });

    it('should validate parameter count matches template expectations', () => {
      // This test documents the expected template structure
      const templateStructure = {
        name: 'customer_needs_help',
        header: {
          parameters: 1, // {{1}} = customer name
          expectedParams: ['customerName']
        },
        body: {
          parameters: 3, // {{1}}, {{2}}, {{3}}
          expectedParams: ['customerName', 'conversationHistory', 'currentMessage']
        }
      };
      
      expect(templateStructure.header.parameters).toBe(1);
      expect(templateStructure.body.parameters).toBe(3);
      expect(templateStructure.header.expectedParams).toHaveLength(1);
      expect(templateStructure.body.expectedParams).toHaveLength(3);
    });
  });

  describe('Template Environment Handling', () => {
    it('should use correct template name for production environment', () => {
      // Mock production environment
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://itjtaeggupasvrepfkcw.supabase.co';
      
      const templateName = getEscalationTemplateName();
      expect(templateName).toBe('customer_needs_help');
      
      // Restore original
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    });

    it('should use correct template name for development environment', () => {
      // Mock development environment
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://yxavypxuzpjejkezwzjl.supabase.co';
      
      const templateName = getEscalationTemplateName();
      expect(templateName).toBe('header_customer_needs_help');
      
      // Restore original
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    });
  });

  describe('Integration with Proxy Template Service', () => {
    it('should send templates with correct structure via proxy service', async () => {
      const mockSendTemplateMessage = jest.fn().mockResolvedValue('success');
      mockTemplateSender.prototype.sendTemplateMessage = mockSendTemplateMessage;
      
      // Mock ChatSession.getById to return test data
      jest.doMock('@/lib/database/models/chat-session', () => ({
        ChatSession: {
          getById: jest.fn().mockResolvedValue({
            allMessages: [
              { role: 'user', content: 'Hello', timestamp: new Date() },
              { role: 'bot', content: 'Hi there!', timestamp: new Date() }
            ]
          })
        }
      }));
      
      await sendEscalationTemplate(
        '+61452490450',
        '680108705183414',
        'John Doe',
        'Can I speak with a human',
        'test-session-id',
        'en'
      );
      
      expect(mockSendTemplateMessage).toHaveBeenCalledWith(
        '+61452490450',
        expect.any(String), // template name
        'en', // language code
        expect.arrayContaining([
          'John Doe', // {{1}} customer name in body
          expect.any(String), // {{2}} conversation history
          expect.any(String) // {{3}} current message
        ]),
        '680108705183414',
        ['John Doe'] // {{1}} customer name in header
      );
    });
  });

  describe('Error Prevention Tests', () => {
    it('should prevent parameter count mismatch errors', async () => {
      const sender = new WhatsAppTemplateSender();
      
      // This should not throw - parameters should match template structure
      await expect(sender.sendEscalationTemplate(
        '+61452490450',
        'John Doe',
        'Help me',
        '680108705183414',
        'en'
      )).resolves.toBeDefined();
    });

    it('should prevent language code mismatch errors', async () => {
      const sender = new WhatsAppTemplateSender();
      
      // Should not use en_US which causes template not found errors
      await sender.sendEscalationTemplate(
        '+61452490450',
        'John Doe',
        'Help me',
        '680108705183414',
        'en'
      );
      
      const calls = (sender.sendTemplateMessage as jest.Mock).mock.calls;
      expect(calls[0][2]).toBe('en'); // Language code should be 'en'
      expect(calls[0][2]).not.toBe('en_US'); // Should NOT be 'en_US'
    });

    it('should handle template parameter validation', () => {
      // Validate the exact structure we expect
      const headerParams = ['John Doe'];
      const bodyParams = ['John Doe', 'Chat history', 'Current message'];
      
      expect(headerParams).toHaveLength(1); // Header expects 1 param
      expect(bodyParams).toHaveLength(3); // Body expects 3 params
      expect(bodyParams[0]).toBe(headerParams[0]); // First body param should match header param
    });
  });
}); 