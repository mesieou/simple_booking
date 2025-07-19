import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NOTIFICATION_TEST_CONFIG, MockWhatsAppSender, TestUtils } from './config/test-config';

// Mock the WhatsApp sender
jest.mock('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender', () => ({
  WhatsappSender: MockWhatsAppSender
}));

describe('Feedback Notification Tests', () => {
  beforeEach(async () => {
    MockWhatsAppSender.reset();
    await TestUtils.cleanupTestData();
  });

  afterEach(async () => {
    await TestUtils.cleanupTestData();
  });

  describe('🚨 CRITICAL: System Notification Type Tests', () => {
    it('should send feedback notifications only to super admins', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      // Test recipient finding for system type (should include ONLY super admins)
      const recipients = await GenericNotificationService.findNotificationRecipients(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        'system'
      );

      expect(recipients.length).toBeGreaterThan(0);
      
      // Should NOT include business admin for system notifications
      const hasBusinessAdmin = recipients.some(r => 
        r.name.includes('Luisa') && r.phoneNumber.includes('61452678816')
      );
      
      // Should include super admin
      const hasSuperAdmin = recipients.some(r => 
        r.name.includes('Super Admin') && r.phoneNumber.includes('61450549485')
      );
      
      expect(hasBusinessAdmin).toBe(false); // Business admin should NOT receive system notifications
      expect(hasSuperAdmin).toBe(true); // Super admin should receive system notifications
    });
  });

  describe('👎 Negative Feedback Notification Flow Tests', () => {
    it('should send negative feedback notification to super admin only', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const feedbackContent = {
        title: '🚨 NEGATIVE BOT FEEDBACK ALERT 🚨',
        message: `📱 **Customer:** +61452490450\n📝 **Session ID:** ${NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID}\n🏢 **Business ID:** ${NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID}\n\n🤖 **Bot Message:**\n"I'm sorry, I don't understand your request."\n\n💬 **Admin Feedback:**\n"Bot response was not helpful"\n\n⏰ **Time:** ${new Date().toLocaleString()}\n\n🔗 **Action Required:** Please review this conversation in the admin dashboard to improve bot responses.\n\n---\nThis is an automated alert for negative bot feedback.`,
        details: {
          feedbackType: 'thumbs_down',
          customerPhoneNumber: '+61452490450',
          messageContent: "I'm sorry, I don't understand your request.",
          feedbackText: 'Bot response was not helpful',
          timestamp: new Date().toISOString()
        }
      };

      await GenericNotificationService.sendNotification({
        type: 'system',
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        content: feedbackContent
      });

      // Verify WhatsApp message was sent
      expect(MockWhatsAppSender.lastMessage).toBeTruthy();
      expect(MockWhatsAppSender.lastMessage.text).toContain('🚨 NEGATIVE BOT FEEDBACK ALERT 🚨');
      expect(MockWhatsAppSender.lastMessage.text).toContain('+61452490450');
      expect(MockWhatsAppSender.lastMessage.text).toContain('Bot response was not helpful');
    });

    it('should create feedback notification with correct UUID handling', async () => {
      const { Notification } = await import('@/lib/database/models/notification');
      
      // Test feedback notification creation
      const notification = await Notification.create({
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        message: 'Negative feedback alert: Customer was not satisfied with bot response',
        status: 'pending',
        notificationType: 'system'
      });

      expect(notification).toBeTruthy();
      expect(notification.chatSessionId).toBe(NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID);
      expect(notification.notificationType).toBe('system');
    });
  });

  describe('📊 Production Feedback Flow Simulation', () => {
    it('should simulate exact feedback flow from feedback/route.ts', async () => {
      // Simulate the API call that triggers feedback notifications
      const sessionId = NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID;
      const messageContent = "I understand you're looking for appointment booking. Let me help you find available times.";
      const feedbackText = "Bot didn't understand my specific request for next Tuesday";
      const customerPhoneNumber = '+61452490450';
      const businessId = NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID;

      // Simulate the sendNegativeFeedbackNotification function
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const title = "🚨 NEGATIVE BOT FEEDBACK ALERT 🚨";
      
      let message = `📱 **Customer:** ${customerPhoneNumber}\n`;
      message += `📝 **Session ID:** ${sessionId}\n`;
      message += `🏢 **Business ID:** ${businessId}\n\n`;
      
      message += `🤖 **Bot Message:**\n`;
      message += `"${messageContent}"\n\n`;
      
      if (feedbackText) {
        message += `💬 **Admin Feedback:**\n`;
        message += `"${feedbackText}"\n\n`;
      }
      
      message += `⏰ **Time:** ${new Date().toLocaleString()}\n\n`;
      message += `🔗 **Action Required:** Please review this conversation in the admin dashboard to improve bot responses.\n\n`;
      message += `---\n`;
      message += `This is an automated alert for negative bot feedback.`;

      console.log('[Test] Simulating production feedback notification flow...');
      
      const startTime = Date.now();
      await GenericNotificationService.sendNotification({
        type: 'system', // Use 'system' type for negative feedback
        businessId,
        chatSessionId: sessionId,
        content: {
          title,
          message,
          details: {
            feedbackType: 'thumbs_down',
            customerPhoneNumber,
            messageContent,
            feedbackText,
            timestamp: new Date().toISOString()
          }
        }
      });
      const endTime = Date.now();

      console.log(`[Test] Feedback notification completed in ${endTime - startTime}ms`);
      
      // Verify success
      expect(MockWhatsAppSender.lastMessage).toBeTruthy();
      expect(MockWhatsAppSender.lastMessage.text).toContain('NEGATIVE BOT FEEDBACK ALERT');
      expect(MockWhatsAppSender.lastMessage.text).toContain(customerPhoneNumber);
      expect(MockWhatsAppSender.lastMessage.text).toContain(feedbackText);
      expect(MockWhatsAppSender.lastMessage.text).toContain(messageContent);
    });
  });

  describe('🗃️ Database Integration Tests', () => {
    it('should save feedback notification to database with system type', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
      
      const feedbackContent = {
        title: '🚨 NEGATIVE BOT FEEDBACK ALERT 🚨',
        message: 'Test feedback notification',
        details: { feedbackType: 'thumbs_down' }
      };

      await GenericNotificationService.sendNotification({
        type: 'system',
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
        content: feedbackContent
      });

      // Check database for created notifications
      const supa = getEnvironmentServiceRoleClient();
      const { data: notifications } = await supa
        .from('notifications')
        .select('*')
        .eq('businessId', NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID)
        .eq('notificationType', 'system')
        .ilike('message', '%Test feedback notification%');

      expect(notifications).toBeTruthy();
      expect(notifications!.length).toBeGreaterThan(0);
      
      const notification = notifications![0];
      expect(notification.chatSessionId).toBe(NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID);
      expect(notification.notificationType).toBe('system');
      expect(notification.businessId).toBe(NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID);
    });
  });

  describe('🔧 Feedback Error Handling Tests', () => {
    it('should handle WhatsApp sending failures in feedback notifications', async () => {
      MockWhatsAppSender.shouldFail = true;
      MockWhatsAppSender.failureReason = 'Feedback WhatsApp API error';

      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const feedbackContent = {
        title: '🚨 NEGATIVE BOT FEEDBACK ALERT 🚨',
        message: 'Test feedback with failure',
        details: { feedbackType: 'thumbs_down' }
      };

      // Should not throw error even if WhatsApp sending fails
      await expect(
        GenericNotificationService.sendNotification({
          type: 'system',
          businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          chatSessionId: NOTIFICATION_TEST_CONFIG.TEST_SESSION.ID,
          content: feedbackContent
        })
      ).resolves.not.toThrow();
    });

    it('should handle feedback notifications without chat session', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const feedbackContent = {
        title: '🚨 NEGATIVE BOT FEEDBACK ALERT 🚨',
        message: 'System feedback without session',
        details: { feedbackType: 'system_error' }
      };

      // Should handle null chatSessionId for system notifications
      await expect(
        GenericNotificationService.sendNotification({
          type: 'system',
          businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          chatSessionId: null, // No session for system notifications
          content: feedbackContent
        })
      ).resolves.not.toThrow();
    });
  });

  describe('🔍 Comparison Tests', () => {
    it('should differentiate between notification types correctly', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      // Test booking type recipients (admin + super admin)
      const bookingRecipients = await GenericNotificationService.findNotificationRecipients(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        'booking'
      );
      
      // Test escalation type recipients (admin + super admin)
      const escalationRecipients = await GenericNotificationService.findNotificationRecipients(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        'escalation'
      );
      
      // Test system type recipients (super admin only)
      const systemRecipients = await GenericNotificationService.findNotificationRecipients(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        'system'
      );

      // Booking and escalation should have same recipients (admin + super admin)
      expect(bookingRecipients.length).toBe(escalationRecipients.length);
      
      // System should have fewer recipients (super admin only)
      expect(systemRecipients.length).toBeLessThan(bookingRecipients.length);
      
      // System recipients should only include super admin
      const systemHasBusinessAdmin = systemRecipients.some(r => 
        r.name.includes('Luisa') && r.phoneNumber.includes('61452678816')
      );
      expect(systemHasBusinessAdmin).toBe(false);
    });
  });
}); 