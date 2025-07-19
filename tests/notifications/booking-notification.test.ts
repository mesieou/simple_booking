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

  describe('🚨 CRITICAL: UUID Handling Tests', () => {
    it('should handle null chatSessionId without UUID validation errors', async () => {
      // This is the EXACT scenario that's failing in production
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const bookingDetails = TestUtils.generateTestBookingDetails();
      
      // Test the exact call that's failing in production - no chatSessionId provided
      const notificationPromise = GenericNotificationService.sendBookingNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        bookingDetails
      );

      // This should NOT throw a UUID validation error
      await expect(notificationPromise).resolves.not.toThrow();
    });

    it('should create notification with null chatSessionId in database', async () => {
      const { Notification } = await import('@/lib/database/models/notification');
      
      // Test direct notification creation with null chatSessionId
      const notification = await Notification.create({
        businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        chatSessionId: null, // This should work
        message: 'Test booking notification',
        status: 'pending',
        notificationType: 'booking'
      });

      expect(notification).toBeTruthy();
      expect(notification.chatSessionId).toBeNull();
      expect(notification.notificationType).toBe('booking');
    });

    it('should NOT accept system-generated as chatSessionId', async () => {
      const { Notification } = await import('@/lib/database/models/notification');
      
      // This is the OLD broken behavior that should fail
      const createWithInvalidUUID = async () => {
        return await Notification.create({
          businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          chatSessionId: 'system-generated' as any, // This should fail
          message: 'Test booking notification',
          status: 'pending',
          notificationType: 'booking'
        });
      };

      // This should throw a UUID validation error
      await expect(createWithInvalidUUID()).rejects.toThrow();
    });
  });

  describe('📱 Booking Notification Flow Tests', () => {
    it('should send booking notification to admin and super admin', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const bookingDetails = TestUtils.generateTestBookingDetails();
      
      // Execute the full booking notification flow
      await GenericNotificationService.sendBookingNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        bookingDetails
      );

      // Verify WhatsApp messages were sent
      expect(MockWhatsAppSender.lastMessage).toBeTruthy();
      expect(MockWhatsAppSender.lastMessage.text).toContain('🎉 New Booking Confirmed!');
      expect(MockWhatsAppSender.lastMessage.text).toContain('Test Customer');
      expect(MockWhatsAppSender.lastMessage.text).toContain('Gel Manicure');
      expect(MockWhatsAppSender.lastMessage.text).toContain('July 21, 2025');
    });

    it('should find correct recipients for booking notifications', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      // Test recipient finding for booking type (should include both admin and super admin)
      const recipients = await GenericNotificationService.findNotificationRecipients(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        'booking'
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

    it('should format booking notification message correctly', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const bookingDetails = TestUtils.generateTestBookingDetails();
      const content = GenericNotificationService.formatBookingNotificationContent(bookingDetails);

      expect(content.title).toBe(NOTIFICATION_TEST_CONFIG.EXPECTED_MESSAGES.BOOKING_NOTIFICATION_TITLE);
      expect(content.message).toContain('Test Customer');
      expect(content.message).toContain('+61452490450');
      expect(content.message).toContain('Gel Manicure');
      expect(content.message).toContain('July 21, 2025');
      expect(content.message).toContain('8:00 AM');
      expect(content.message).toContain('$44');
      expect(content.message).toContain('$24');
      expect(content.message).toContain('$20');
    });
  });

  describe('🔧 Error Handling Tests', () => {
    it('should handle WhatsApp sending failures gracefully', async () => {
      MockWhatsAppSender.shouldFail = true;
      MockWhatsAppSender.failureReason = 'WhatsApp API error';

      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const bookingDetails = TestUtils.generateTestBookingDetails();
      
      // Should not throw error even if WhatsApp sending fails
      await expect(
        GenericNotificationService.sendBookingNotification(
          NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
          bookingDetails
        )
      ).resolves.not.toThrow();
    });

    it('should handle missing business gracefully', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const bookingDetails = TestUtils.generateTestBookingDetails();
      const invalidBusinessId = '00000000-0000-0000-0000-000000000000';
      
      // Should not throw error even with invalid business ID
      await expect(
        GenericNotificationService.sendBookingNotification(
          invalidBusinessId,
          bookingDetails
        )
      ).resolves.not.toThrow();
    });
  });

  describe('🗃️ Database Persistence Tests', () => {
    it('should save notification to database with correct data', async () => {
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
      
      const bookingDetails = TestUtils.generateTestBookingDetails();
      
      // Execute notification
      await GenericNotificationService.sendBookingNotification(
        NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
        bookingDetails
      );

      // Check database for created notifications
      const supa = getEnvironmentServiceRoleClient();
      const { data: notifications } = await supa
        .from('notifications')
        .select('*')
        .eq('businessId', NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID)
        .eq('notificationType', 'booking')
        .ilike('message', '%New Booking Confirmed%');

      expect(notifications).toBeTruthy();
      expect(notifications!.length).toBeGreaterThan(0);
      
      const notification = notifications![0];
      expect(notification.chatSessionId).toBeNull(); // Should be null, not 'system-generated'
      expect(notification.notificationType).toBe('booking');
      expect(notification.businessId).toBe(NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID);
    });
  });

  describe('📊 Production Flow Simulation', () => {
    it('should simulate exact production booking flow from create-booking.ts', async () => {
      // This simulates the exact call made in create-booking.ts:505
      const { GenericNotificationService } = await import('@/lib/bot-engine/services/generic-notification-service');
      
      const bookingDetails = {
        bookingId: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.ID,
        customerName: 'Stiffy', // Real customer name from logs
        customerPhone: '+61452490450',
        serviceName: 'Gel Manicure',
        servicesDisplay: 'Gel Manicure',
        isMultiService: false,
        formattedDate: 'July 21, 2025',
        formattedTime: '8:00 AM',
        location: 'Apt 111, 9 Dryburgh st, West Melbourne, VIC 3003',
        totalCost: 44.00,
        amountPaid: 24.00,
        amountOwed: 20.00
      };

      // This is the EXACT call that's failing in production
      console.log('[Test] Simulating production booking notification flow...');
      
      const startTime = Date.now();
      await GenericNotificationService.sendBookingNotification(
        '5fbb7083-0de0-4bd2-bdbd-7f0260f3c7cc', // Real business ID from logs
        bookingDetails
      );
      const endTime = Date.now();

      console.log(`[Test] Notification flow completed in ${endTime - startTime}ms`);
      
      // Verify success
      expect(MockWhatsAppSender.lastMessage).toBeTruthy();
      expect(MockWhatsAppSender.lastMessage.text).toContain('Stiffy');
    });
  });
}); 