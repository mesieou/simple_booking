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

  describe('🚨 CRITICAL: Template-Based Feedback Notifications', () => {
    it('should send negative feedback notification using WhatsApp template', async () => {
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const feedbackDetails = {
        customerName: 'Unhappy Customer',
        feedbackText: 'The service was terrible and I am very disappointed.',
        businessName: 'Beauty Salon XYZ',
        timestamp: 'March 15, 2025'
      };
      
      // Mock template message sending
      MockWhatsAppSender.mockTemplateSuccess('wamid_template_feedback_123');
      
      const notificationService = new ScalableNotificationService();
      await notificationService.sendFeedbackNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        feedbackDetails
      );
      
      // Verify template was called with correct parameters
      const templateCalls = MockWhatsAppSender.getTemplateCalls();
      expect(templateCalls).toHaveLength(1); // Should only send to super admin for system notifications
      
      const firstCall = templateCalls[0];
      expect(firstCall.templateName).toBe('negative_feedback_alert');
      expect(firstCall.languageCode).toBe('en');
      expect(firstCall.headerParams).toEqual([]); // No header parameters for this template
      expect(firstCall.bodyParams).toEqual([
        'Unhappy Customer',
        'Beauty Salon XYZ',
        'March 15, 2025',
        'The service was terrible and I am very disappointed.'
      ]);
      
      // Verify it was sent to super admin only
      expect(templateCalls[0].recipientPhone).toBe(NOTIFICATION_TEST_CONFIG.TEST_SUPER_ADMIN_USER.PHONE);
      
      console.log('✅ Template-based feedback notification test passed');
    });

    it('should only send feedback notifications to super admins', async () => {
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const feedbackDetails = {
        customerName: 'Test Customer',
        feedbackText: 'Negative feedback content',
        businessName: 'Test Business',
      };
      
      MockWhatsAppSender.mockTemplateSuccess('wamid_template_feedback_456');
      
      const notificationService = new ScalableNotificationService();
      await notificationService.sendFeedbackNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        feedbackDetails
      );
      
      const templateCalls = MockWhatsAppSender.getTemplateCalls();
      
      // Should only have 1 call (to super admin), not 2 (admin + super admin)
      expect(templateCalls).toHaveLength(1);
      expect(templateCalls[0].recipientPhone).toBe(NOTIFICATION_TEST_CONFIG.TEST_SUPER_ADMIN_USER.PHONE);
      
      console.log('✅ Super admin only notification test passed');
    });
  });

  describe('🚨 CRITICAL: System Notification Type Tests', () => {
    it('should create system type notifications for feedback', async () => {
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const feedbackDetails = {
        customerName: 'Test Customer',
        feedbackText: 'Service was poor',
        businessName: 'Test Business'
      };
      
      MockWhatsAppSender.mockTemplateSuccess('wamid_template_feedback_789');
      
      const notificationService = new ScalableNotificationService();
      await notificationService.sendFeedbackNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        feedbackDetails
      );
      
      const recentNotifications = await TestUtils.getRecentNotifications();
      const feedbackNotifications = recentNotifications.filter(n => n.notificationType === 'system');
      
      expect(feedbackNotifications.length).toBeGreaterThanOrEqual(1);
      
      const notification = feedbackNotifications[0];
      expect(notification.businessId).toBe(NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID);
      expect(notification.chatSessionId).toBeNull(); // Feedback doesn't have chat sessions
      expect(notification.notificationType).toBe('system');
      expect(notification.status).toBe('pending');
      
      console.log('✅ System notification type test passed');
    });

    it('should handle null chatSessionId for system notifications without UUID errors', async () => {
      // This tests that system notifications don't have the UUID issue
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const feedbackDetails = {
        customerName: 'Critical Test Customer',
        feedbackText: 'This is a test for UUID handling',
        businessName: 'Critical Test Business'
      };
      
      MockWhatsAppSender.mockTemplateSuccess('wamid_template_feedback_critical');
      
      // This should NOT try to create a UUID from 'system-generated'
      const notificationService = new ScalableNotificationService();
      await expect(
        notificationService.sendFeedbackNotification(
          NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          feedbackDetails
        )
      ).resolves.not.toThrow();
      
      // Verify notification was created with NULL chatSessionId
      const recentNotifications = await TestUtils.getRecentNotifications();
      const systemNotification = recentNotifications.find(n => 
        n.notificationType === 'system' && 
        n.message.includes('Critical Test Customer')
      );
      
      expect(systemNotification).toBeDefined();
      expect(systemNotification?.chatSessionId).toBeNull(); // Should be NULL, not 'system-generated'
      
      console.log('✅ System notification UUID handling test passed');
    });
  });

  describe('📋 Template Content Tests', () => {
    it('should clean feedback text for WhatsApp template compliance', async () => {
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const feedbackDetails = {
        customerName: 'Test Customer',
        feedbackText: 'This feedback has\nnewlines and\ttabs and    multiple spaces that need cleaning',
        businessName: 'Test Business',
        timestamp: 'March 23, 2025'
      };
      
      MockWhatsAppSender.mockTemplateSuccess('wamid_clean_feedback_test');
      
      const notificationService = new ScalableNotificationService();
      await notificationService.sendFeedbackNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        feedbackDetails
      );
      
      const templateCalls = MockWhatsAppSender.getTemplateCalls();
      const call = templateCalls[0];
      
      // Check that feedback text is cleaned for WhatsApp
      const cleanedFeedbackText = call.bodyParams[3];
      expect(cleanedFeedbackText).not.toContain('\n');
      expect(cleanedFeedbackText).not.toContain('\t');
      expect(cleanedFeedbackText).toBe('This feedback has newlines and tabs and multiple spaces that need cleaning');
      
      console.log('✅ Feedback text cleaning test passed');
    });
  });
}); 