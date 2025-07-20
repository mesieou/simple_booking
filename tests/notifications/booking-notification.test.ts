import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NOTIFICATION_TEST_CONFIG, MockWhatsAppSender, TestUtils } from './config/test-config';

// Mock the WhatsApp sender
jest.mock('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender', () => ({
  WhatsappSender: MockWhatsAppSender
}));

describe('Booking Notification Tests', () => {
  beforeEach(async () => {
    MockWhatsAppSender.reset();
    await TestUtils.cleanupTestData();
  });

  afterEach(async () => {
    await TestUtils.cleanupTestData();
  });

  describe('🚨 CRITICAL: Template-Based Booking Notifications', () => {
    it('should send booking notification using WhatsApp template', async () => {
      // This tests the new template-based booking notification system
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const bookingDetails = {
        bookingId: 'BK123456',
        customerName: 'Test Customer',
        customerPhone: '+61452678816',
        serviceName: 'Hair Cut & Style',
        servicesDisplay: 'Hair Cut & Style',
        isMultiService: false,
        formattedDate: 'March 15, 2025',
        formattedTime: '2:30 PM',
        location: 'Beauty Salon XYZ',
        totalCost: 75.00,
        amountPaid: 25.00,
        amountOwed: 50.00
      };
      
      // Mock template message sending
      MockWhatsAppSender.mockTemplateSuccess('wamid_template_booking_123');
      
      const notificationService = new ScalableNotificationService();
      await notificationService.sendBookingNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        bookingDetails
      );
      
      // Verify template was called with correct parameters
      const templateCalls = MockWhatsAppSender.getTemplateCalls();
      expect(templateCalls).toHaveLength(2); // Should send to admin + super admin
      
      const firstCall = templateCalls[0];
      expect(firstCall.templateName).toBe('booking_confirmation');
      expect(firstCall.languageCode).toBe('en');
      expect(firstCall.headerParams).toEqual(['Test Customer']);
      expect(firstCall.bodyParams).toEqual([
        'BK123456',
        'Hair Cut & Style',
        'March 15, 2025',
        '2:30 PM',
        '$75'
      ]);
      
      console.log('✅ Template-based booking notification test passed');
    });

    it('should handle template validation errors gracefully', async () => {
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const bookingDetails = {
        bookingId: '', // Empty booking ID should cause validation error
        customerName: 'Test Customer',
        serviceName: 'Hair Cut',
        formattedDate: 'March 15, 2025',
        formattedTime: '2:30 PM',
        totalCost: 75.00
      };
      
      // Mock template failure
      MockWhatsAppSender.mockTemplateError('Template validation failed: empty parameter');
      
      const notificationService = new ScalableNotificationService();
      await expect(
        notificationService.sendBookingNotification(
          NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          bookingDetails
        )
      ).rejects.toThrow('Template validation failed');
      
      console.log('✅ Template validation error handling test passed');
    });

    it('should format customer-style detailed notification messages', async () => {
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const bookingDetails = {
        bookingId: 'BK999888',
        customerName: 'John Smith',
        customerPhone: '+61452678816',
        serviceName: 'Full Service Package',
        servicesDisplay: 'Hair Cut + Color + Style',
        isMultiService: true,
        formattedDate: 'March 20, 2025',
        formattedTime: '10:00 AM',
        location: 'Beauty Salon XYZ',
        totalCost: 150.00,
        travelCost: 10.00,
        amountPaid: 50.00,
        amountOwed: 100.00,
        paymentMethod: 'cash/card',
        providerContactInfo: '+61452678816 • provider@salon.com'
      };
      
      MockWhatsAppSender.mockTemplateSuccess('wamid_detailed_test');
      
      const notificationService = new ScalableNotificationService();
      await notificationService.sendBookingNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        bookingDetails
      );
      
      // Check the detailed message formatting
      const regularCalls = MockWhatsAppSender.getRegularCalls();
      if (regularCalls.length > 0) {
        const detailedMessage = regularCalls[0].message.text;
        
        // Should include customer-style formatting
        expect(detailedMessage).toContain('🎉 John Smith, booking confirmed!');
        expect(detailedMessage).toContain('💼 Services:');
        expect(detailedMessage).toContain('Hair Cut + Color + Style');
        expect(detailedMessage).toContain('🚗 Travel: $10.00');
        expect(detailedMessage).toContain('💰 Total Cost: $150.00');
        expect(detailedMessage).toContain('💳 Payment Summary:');
        expect(detailedMessage).toContain('📞 Customer Contact:');
        expect(detailedMessage).toContain('📄 Booking ID: BK999888');
      }
      
      console.log('✅ Customer-style detailed message test passed');
    });
  });

  describe('🚨 CRITICAL: UUID Handling Tests', () => {
    it('should handle null chatSessionId without UUID validation errors', async () => {
      // This is the EXACT scenario that was causing production failures
      const { ScalableNotificationService } = await import('@/lib/bot-engine/services/scalable-notification-service');
      
      const bookingDetails = {
        bookingId: 'BK789012',
        customerName: 'Test Customer',
        serviceName: 'Service Test',
        formattedDate: 'March 16, 2025',
        formattedTime: '3:00 PM',
        totalCost: 100.00
      };
      
      // Mock successful template sending
      MockWhatsAppSender.mockTemplateSuccess('wamid_template_booking_456');
      
      // This should NOT try to create a UUID from 'system-generated'
      const notificationService = new ScalableNotificationService();
      await expect(
        notificationService.sendBookingNotification(
          NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          bookingDetails
        )
      ).resolves.not.toThrow();
      
      // Verify notification was created with NULL chatSessionId
      const { Notification } = await import('@/lib/database/models/notification');
      const recentNotifications = await TestUtils.getRecentNotifications();
      
      const bookingNotification = recentNotifications.find(n => 
        n.notificationType === 'booking' && 
        n.message.includes('BK789012')
      );
      
      expect(bookingNotification).toBeDefined();
      expect(bookingNotification?.chatSessionId).toBeNull(); // Should be NULL, not 'system-generated'
      
      console.log('✅ UUID handling test passed - no "system-generated" string used');
    });
  });
}); 