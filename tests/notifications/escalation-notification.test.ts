import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NOTIFICATION_TEST_CONFIG, MockWhatsAppSender, TestUtils } from './config/test-config';

// Mock the WhatsApp sender
jest.mock('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender', () => ({
  WhatsappSender: MockWhatsAppSender
}));

describe('Escalation Notification Tests', () => {
  beforeEach(async () => {
    MockWhatsAppSender.reset();
    await TestUtils.cleanupTestData();
  });

  afterEach(async () => {
    await TestUtils.cleanupTestData();
  });

  describe('🚨 Escalation Notification Flow Tests', () => {
    it('should send escalation notification to admin and super admin', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      // Simulate escalation with real chat session
      const escalationContent = {
        title: '🚨 Customer Needs Assistance',
        message: 'Customer Juan has requested human assistance.\n\nReason: General inquiry\nTime: 2025-01-19 10:30 AM\n\nPlease respond to continue the conversation.',
        details: {
          customerPhone: NOTIFICATION_TEST_CONFIG.TEST_CUSTOMER_USER.PHONE,
          escalationReason: 'General inquiry',
          timestamp: new Date().toISOString()
        }
      };

      await GenericNotificationService.sendNotification({
        type: 'escalation',
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        content: escalationContent
      });

      // Verify WhatsApp messages were sent
      expect(MockWhatsAppSender.lastMessage).toBeTruthy();
      expect(MockWhatsAppSender.lastMessage.text).toContain('🚨 Customer Needs Assistance');
      expect(MockWhatsAppSender.lastMessage.text).toContain('Juan');
    });

    it('should find correct recipients for escalation notifications', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      // Test recipient finding for escalation type (should include both admin and super admin)
      const recipients = await GenericNotificationService.findNotificationRecipients(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        'escalation'
      );

      expect(recipients.length).toBeGreaterThan(0);
      
      // Should include business admin
      const hasBusinessAdmin = recipients.some(r => 
        r.name.includes('Luisa') && r.phoneNumber.includes('61452678816')
      );
      
      // Should include super admin
      const hasSuperAdmin = recipients.some(r => 
        r.name.includes('Super Admin') && r.phoneNumber.includes('61450549485')
      );
      
      expect(hasBusinessAdmin).toBe(true);
      expect(hasSuperAdmin).toBe(true);
    });

    it('should create escalation notification with valid chatSessionId', async () => {
      const { Notification } = await import('@/lib/database/models/notification');
      
      // Test escalation notification creation with real chat session ID
      const notification = await Notification.create({
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        message: 'Customer needs assistance',
        status: 'pending',
        notificationType: 'escalation'
      });

      expect(notification).toBeTruthy();
      expect(notification.chatSessionId).toBe(NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID);
      expect(notification.notificationType).toBe('escalation');
    });
  });

  describe('🔄 Proxy Mode Escalation Tests', () => {
    it('should handle proxy mode escalation notifications', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const proxyEscalationContent = {
        title: '📞 Escalation - Proxy Mode Active',
        message: 'Customer conversation has been escalated to proxy mode.\n\nAdmin: Please respond via WhatsApp to continue the conversation.\nCustomer: +61452490450\n\nThe customer will receive your direct messages.',
        details: {
          customerPhone: NOTIFICATION_TEST_CONFIG.TEST_CUSTOMER_USER.PHONE,
          escalationMode: 'proxy',
          adminPhone: NOTIFICATION_TEST_CONFIG.TEST_ADMIN_USER.PHONE
        }
      };

      await GenericNotificationService.sendNotification({
        type: 'escalation',
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        content: proxyEscalationContent
      });

      expect(MockWhatsAppSender.lastMessage).toBeTruthy();
      expect(MockWhatsAppSender.lastMessage.text).toContain('Proxy Mode Active');
      expect(MockWhatsAppSender.lastMessage.text).toContain('+61452490450');
    });
  });

  describe('🗃️ Database Integration Tests', () => {
    it('should save escalation notification to database with correct data', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
      
      const escalationContent = {
        title: '🚨 Customer Needs Assistance',
        message: 'Test escalation notification',
        details: { reason: 'test' }
      };

      await GenericNotificationService.sendNotification({
        type: 'escalation',
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        content: escalationContent
      });

      // Check database for created notifications
      const supa = getEnvironmentServiceRoleClient();
      const { data: notifications } = await supa
        .from('notifications')
        .select('*')
        .eq('businessId', NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID)
        .eq('notificationType', 'escalation')
        .ilike('message', '%Test escalation notification%');

      expect(notifications).toBeTruthy();
      expect(notifications!.length).toBeGreaterThan(0);
      
      const notification = notifications![0];
      expect(notification.chatSessionId).toBe(NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID);
      expect(notification.notificationType).toBe('escalation');
      expect(notification.businessId).toBe(NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID);
    });
  });

  describe('🔧 Escalation Error Handling Tests', () => {
    it('should handle WhatsApp sending failures in escalations', async () => {
      MockWhatsAppSender.shouldFail = true;
      MockWhatsAppSender.failureReason = 'Escalation WhatsApp API error';

      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const escalationContent = {
        title: '🚨 Customer Needs Assistance',
        message: 'Test escalation with failure',
        details: {}
      };

      // Should not throw error even if WhatsApp sending fails
      await expect(
        GenericNotificationService.sendNotification({
          type: 'escalation',
          businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
          content: escalationContent
        })
      ).resolves.not.toThrow();
    });

    it('should handle missing chat session gracefully', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const escalationContent = {
        title: '🚨 Customer Needs Assistance',
        message: 'Test escalation without session',
        details: {}
      };

      const invalidSessionId = '00000000-0000-0000-0000-000000000000';

      // Should not throw error even with invalid session ID
      await expect(
        GenericNotificationService.sendNotification({
          type: 'escalation',
          businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          chatSessionId: invalidSessionId,
          content: escalationContent
        })
      ).resolves.not.toThrow();
    });
  });

  describe('📊 Production Escalation Flow Simulation', () => {
    it('should simulate real escalation from escalation-orchestrator.ts', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      // Simulate the exact escalation flow
      const escalationReason = 'customer_request';
      const customerPhone = '+61452490450';
      
      const escalationContent = {
        title: '🚨 Customer Needs Assistance',
        message: `Customer ${customerPhone} has requested human assistance.\n\nReason: ${escalationReason}\nBusiness: Beauty Asiul\nTime: ${new Date().toLocaleString()}\n\nPlease respond to continue the conversation.`,
        details: {
          customerPhone,
          escalationReason,
          businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          timestamp: new Date().toISOString()
        }
      };

      console.log('[Test] Simulating production escalation flow...');
      
      const startTime = Date.now();
      await GenericNotificationService.sendNotification({
        type: 'escalation',
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        content: escalationContent
      });
      const endTime = Date.now();

      console.log(`[Test] Escalation notification completed in ${endTime - startTime}ms`);
      
      // Verify success
      expect(MockWhatsAppSender.lastMessage).toBeTruthy();
      expect(MockWhatsAppSender.lastMessage.text).toContain('Customer Needs Assistance');
      expect(MockWhatsAppSender.lastMessage.text).toContain(customerPhone);
      expect(MockWhatsAppSender.lastMessage.text).toContain(escalationReason);
    });
  });
}); 