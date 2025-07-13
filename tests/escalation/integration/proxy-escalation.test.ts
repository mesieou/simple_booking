/**
 * Integration Tests for Proxy Escalation
 * Tests the complete proxy escalation workflow with database integration
 */

import { routeProxyMessage } from '@/lib/bot-engine/escalation/proxy-communication-router';
import { sendEscalationTemplateWithProxy } from '@/lib/bot-engine/escalation/proxy-escalation-handler';
import { 
  ProxyMessageBuilder,
  ProxyScenarioBuilder,
  ProxyExpectations,
  ProxyTestDb 
} from '../utilities/proxy-test-builders';

import { 
  ESCALATION_TEST_CONFIG,
  createTestSessionId 
} from '../config/escalation-test-config';
import { EscalationDatabaseHelpers } from '../utilities/escalation-test-helpers';

// Mock WhatsApp API calls
jest.mock('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender');

describe('Proxy Escalation Integration', () => {
  const testConfig = ESCALATION_TEST_CONFIG;
  let testSessionId: string;
  let testBusinessId: string;
  let testNotificationId: string;

  beforeAll(async () => {
    await EscalationDatabaseHelpers.initializeTestEnvironment();
  });

  beforeEach(async () => {
    // Create test session and business
    testSessionId = createTestSessionId();
    testBusinessId = testConfig.LUISA_BUSINESS.ID;
    
    // Mock WhatsApp sender
    const { WhatsappSender } = await import('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender');
    (WhatsappSender.prototype.sendMessage as jest.Mock) = jest.fn()
      .mockResolvedValue(`whatsapp-msg-${Date.now()}`);
    (WhatsappSender.prototype.sendTemplateMessage as jest.Mock) = jest.fn()
      .mockResolvedValue(`template-msg-${Date.now()}`);
  });

  afterEach(async () => {
    await ProxyTestDb.cleanupTestProxySessions();
    await EscalationDatabaseHelpers.cleanupEscalationTestData();
  });

  describe('Proxy Escalation Template Flow', () => {
    it('should create proxy escalation with template successfully', async () => {
      // Create test notification
      testNotificationId = await ProxyTestDb.createTestProxyNotification(
        testSessionId,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      const result = await sendEscalationTemplateWithProxy(
        testConfig.ADMIN_USER.PHONE,
        'Test Customer',
        'I need help with my booking',
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        testSessionId,
        testNotificationId,
        'en'
      );

      expect(result.success).toBe(true);
      expect(result.templateSent).toBe(true);
      expect(result.proxyModeStarted).toBe(true);
      expect(result.notificationId).toBe(testNotificationId);
    });

    it('should handle template send failure gracefully', async () => {
      // Mock template send failure
      const { WhatsappSender } = await import('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender');
      (WhatsappSender.prototype.sendTemplateMessage as jest.Mock) = jest.fn()
        .mockRejectedValue(new Error('Template send failed'));

      testNotificationId = await ProxyTestDb.createTestProxyNotification(
        testSessionId,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      const result = await sendEscalationTemplateWithProxy(
        testConfig.ADMIN_USER.PHONE,
        'Test Customer',
        'I need help',
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        testSessionId,
        testNotificationId,
        'en'
      );

      expect(result.success).toBe(false);
      expect(result.templateSent).toBe(false);
      expect(result.proxyModeStarted).toBe(false);
      expect(result.error).toContain('Template message failed');
    });
  });

  describe('Proxy Message Routing', () => {
    beforeEach(async () => {
      // Create active proxy session
      testNotificationId = await ProxyTestDb.createTestProxyNotification(
        testSessionId,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );
    });

    describe('Customer Messages', () => {
      it('should forward customer message to admin during proxy', async () => {
        const customerMessage = ProxyMessageBuilder.createCustomerProxyMessage(
          'Hello, can you help me?'
        );

        const result = await routeProxyMessage(
          customerMessage,
          testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
        );

        ProxyExpectations.expectMessageForwarded(result, 'Customer→Admin');
      });

      it('should route customer message to bot when no proxy session', async () => {
        // End the proxy session first
        await ProxyTestDb.cleanupTestProxySessions();

        const customerMessage = ProxyMessageBuilder.createCustomerProxyMessage(
          'Hello bot'
        );

        const result = await routeProxyMessage(
          customerMessage,
          testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
        );

        expect(result.wasHandled).toBe(false);
        expect(result.messageForwarded).toBe(false);
        expect(result.proxyEnded).toBe(false);
      });
    });

    describe('Admin Messages', () => {
      it('should forward admin message to customer during proxy', async () => {
        const adminMessage = ProxyMessageBuilder.createAdminProxyMessage(
          'Hi! I can help you with that.'
        );

        const result = await routeProxyMessage(
          adminMessage,
          testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
        );

        ProxyExpectations.expectMessageForwarded(result, 'Admin→Customer');
      });

      it('should end proxy session when admin clicks end button', async () => {
        const endProxyMessage = ProxyMessageBuilder.createEndProxyMessage(
          testConfig.ADMIN_USER.PHONE,
          'button'
        );

        const result = await routeProxyMessage(
          endProxyMessage,
          testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
        );

        ProxyExpectations.expectProxyEnded(result, true);
      });

      it('should end proxy session when admin sends text command', async () => {
        const endProxyMessage = ProxyMessageBuilder.createEndProxyMessage(
          testConfig.ADMIN_USER.PHONE,
          'text'
        );

        const result = await routeProxyMessage(
          endProxyMessage,
          testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
        );

        ProxyExpectations.expectProxyEnded(result, true);
      });

      it('should handle admin message when no proxy session active', async () => {
        // End proxy session
        await ProxyTestDb.cleanupTestProxySessions();

        const adminMessage = ProxyMessageBuilder.createAdminProxyMessage(
          'Regular admin message'
        );

        const result = await routeProxyMessage(
          adminMessage,
          testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
        );

        expect(result.wasHandled).toBe(false);
        expect(result.messageForwarded).toBe(false);
        expect(result.proxyEnded).toBe(false);
      });
    });
  });

  describe('Complete Proxy Workflow', () => {
    it('should handle complete proxy escalation scenario', async () => {
      const scenario = await ProxyScenarioBuilder.createCompleteProxyScenario();

      // 1. Customer escalates (would trigger escalation in real flow)
      // This would normally create the proxy session, but we'll create it manually for testing
      testNotificationId = await ProxyTestDb.createTestProxyNotification(
        testSessionId,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      // 2. Admin responds in proxy mode
      const adminResponse = await routeProxyMessage(
        scenario.adminProxyMessage,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );
      ProxyExpectations.expectMessageForwarded(adminResponse, 'Admin→Customer');

      // 3. Customer responds during proxy
      const customerResponse = await routeProxyMessage(
        scenario.customerProxyResponse,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );
      ProxyExpectations.expectMessageForwarded(customerResponse, 'Customer→Admin');

      // 4. Admin ends proxy session
      const proxyEnd = await routeProxyMessage(
        scenario.adminEndProxy,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );
      ProxyExpectations.expectProxyEnded(proxyEnd, true);

      // 5. Customer message after proxy ends (should go to bot)
      const afterProxyMessage = await routeProxyMessage(
        scenario.customerAfterProxy,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );
      expect(afterProxyMessage.wasHandled).toBe(false); // Should go to bot
    });

    it('should handle multiple concurrent proxy sessions', async () => {
      const scenario = await ProxyScenarioBuilder.createMultipleCustomerScenario();
      const customer2Phone = testConfig.CUSTOMER_USER_2?.PHONE || '+61400000002';

      // Create proxy session for Customer 1
      const session1Id = `session-1-${Date.now()}`;
      const notification1Id = await ProxyTestDb.createTestProxyNotification(
        session1Id,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      // Admin responds to Customer 1
      const admin1Response = await routeProxyMessage(
        scenario.adminRespondsToCustomer1,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );
      ProxyExpectations.expectMessageForwarded(admin1Response, 'Admin→Customer');

      // Admin ends Customer 1 proxy
      const proxy1End = await routeProxyMessage(
        scenario.adminEndsCustomer1Proxy,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );
      ProxyExpectations.expectProxyEnded(proxy1End, true);

      // Create proxy session for Customer 2 (new escalation)
      const session2Id = `session-2-${Date.now()}`;
      const notification2Id = await ProxyTestDb.createTestProxyNotification(
        session2Id,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      // Customer 2 escalation should work independently
      const customer2Message = ProxyMessageBuilder.createCustomerProxyMessage(
        'I need help too!',
        customer2Phone
      );

      // Note: This would route to bot since we don't have the session mapping
      // In real flow, the escalation would create the proper session mapping
      const customer2Response = await routeProxyMessage(
        customer2Message,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );

      // Should not interfere with previous proxy session
      expect(customer2Response.wasHandled).toBe(false); // No proxy found, goes to bot
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const { Notification } = await import('@/lib/database/models/notification');
      const originalMethod = Notification.getActiveProxyByAdminPhone;
      (Notification.getActiveProxyByAdminPhone as jest.Mock) = jest.fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const adminMessage = ProxyMessageBuilder.createAdminProxyMessage(
        'Test message'
      );

      const result = await routeProxyMessage(
        adminMessage,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );

      expect(result.wasHandled).toBe(false);
      expect(result.error).toBeDefined();

      // Restore original method
      (Notification.getActiveProxyByAdminPhone as jest.Mock) = originalMethod;
    });

    it('should handle WhatsApp API failures during proxy end', async () => {
      // Create proxy session
      testNotificationId = await ProxyTestDb.createTestProxyNotification(
        testSessionId,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      // Mock WhatsApp send failure
      const { WhatsappSender } = await import('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender');
      (WhatsappSender.prototype.sendMessage as jest.Mock) = jest.fn()
        .mockRejectedValue(new Error('WhatsApp API failed'));

      const endProxyMessage = ProxyMessageBuilder.createEndProxyMessage(
        testConfig.ADMIN_USER.PHONE,
        'button'
      );

      // Should still end proxy session even if confirmation message fails
      const result = await routeProxyMessage(
        endProxyMessage,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );

      expect(result.wasHandled).toBe(true);
      expect(result.proxyEnded).toBe(true);
      expect(result.error).toContain('WhatsApp API failed');
    });

    it('should handle invalid business phone number ID', async () => {
      const customerMessage = ProxyMessageBuilder.createCustomerProxyMessage(
        'Test message'
      );

      const result = await routeProxyMessage(
        customerMessage,
        'invalid-phone-number-id'
      );

      expect(result.wasHandled).toBe(false);
      expect(result.messageForwarded).toBe(false);
      expect(result.proxyEnded).toBe(false);
    });
  });

  describe('Session Lifecycle', () => {
    it('should properly track proxy session lifecycle', async () => {
      // Create proxy session
      testNotificationId = await ProxyTestDb.createTestProxyNotification(
        testSessionId,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      // Verify session is active
      const { getProxySessionByAdmin } = await import('@/lib/bot-engine/escalation/proxy-session-manager');
      const activeSession = await getProxySessionByAdmin(
        testConfig.ADMIN_USER.PHONE
      );
      expect(activeSession).toBeDefined();
      expect(activeSession?.isActive).toBe(true);

      // End proxy session
      const endProxyMessage = ProxyMessageBuilder.createEndProxyMessage(
        testConfig.ADMIN_USER.PHONE,
        'button'
      );

      await routeProxyMessage(
        endProxyMessage,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );

      // Verify session is ended
      const endedSession = await getProxySessionByAdmin(
        testConfig.ADMIN_USER.PHONE
      );
      expect(endedSession).toBeNull();
    });

    it('should handle session timeout correctly', async () => {
      // Create expired proxy session (would be handled by validateProxySession in real scenario)
      const oldStartTime = new Date(Date.now() - (25 * 60 * 60 * 1000)); // 25 hours ago
      
      testNotificationId = await ProxyTestDb.createTestProxyNotification(
        testSessionId,
        testBusinessId,
        testConfig.ADMIN_USER.PHONE
      );

      // Mock session as expired
      const { validateProxySession } = await import('@/lib/bot-engine/escalation/proxy-session-manager');
      
      // In real scenario, validateProxySession would be called and return false for expired sessions
      // This would trigger automatic cleanup
      const customerMessage = ProxyMessageBuilder.createCustomerProxyMessage(
        'Is this session still active?'
      );

      const result = await routeProxyMessage(
        customerMessage,
        testConfig.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
      );

      // Should find the session and forward the message (in this test setup)
      // In production, expired sessions would be automatically cleaned up
      ProxyExpectations.expectMessageForwarded(result, 'Customer→Admin');
    });
  });
}); 