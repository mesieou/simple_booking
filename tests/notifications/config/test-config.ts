import { randomUUID } from 'crypto';

export const NOTIFICATION_TEST_CONFIG = {
  // Test Business Data
  TEST_BUSINESS: {
    ID: '5fbb7083-0de0-4bd2-bdbd-7f0260f3c7cc', // Use Luisa's business ID
    NAME: 'Beauty Asiul',
    WHATSAPP_PHONE_NUMBER_ID: '684078768113901'
  },

  // Test User Data  
  TEST_ADMIN_USER: {
    ID: 'e4112649-a883-4f4d-a8f5-3f71cadf0863',
    FIRST_NAME: 'Luisa',
    LAST_NAME: 'Bernal',
    EMAIL: 'luisa.bernal7826@gmail.com',
    PHONE: '+61452678816',
    ROLE: 'admin' as const
  },

  TEST_SUPER_ADMIN_USER: {
    ID: 'c9107c0b-a48f-4925-8ec9-52fcf4bfdaco',
    FIRST_NAME: 'juan',
    LAST_NAME: 'bernal', 
    EMAIL: 'info@skedy.io',
    PHONE: '+61450549485',
    ROLE: 'super_admin' as const
  },

  TEST_CUSTOMER_USER: {
    PHONE: '+61452490450',
    NAME: 'Test Customer'
  },

  // Test Booking Data
  TEST_BOOKING: {
    ID: randomUUID(),
    QUOTE_ID: randomUUID(),
    SERVICE_NAME: 'Gel Manicure',
    FORMATTED_DATE: 'July 21, 2025',
    FORMATTED_TIME: '8:00 AM',
    TOTAL_COST: 44.00,
    AMOUNT_PAID: 24.00,
    AMOUNT_OWED: 20.00,
    LOCATION: 'Apt 111, 9 Dryburgh st, West Melbourne, VIC 3003'
  },

  // Test Session Data
  TEST_SESSION: {
    ID: randomUUID(),
    CHANNEL_USER_ID: '61452490450'
  },

  // Test Environment Variables
  ENV: {
    WHATSAPP_PHONE_NUMBER_ID: '684078768113901',
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!
  },

  // Expected notification messages
  EXPECTED_MESSAGES: {
    BOOKING_NOTIFICATION_TITLE: '🎉 New Booking Confirmed!',
    ESCALATION_NOTIFICATION_TITLE: '🚨 Customer Needs Assistance',
    FEEDBACK_NOTIFICATION_TITLE: '🚨 NEGATIVE BOT FEEDBACK ALERT 🚨'
  }
};

/**
 * Mock WhatsApp Sender for testing
 */
export class MockWhatsAppSender {
  static lastMessage: any = null;
  static lastPhoneNumber: string | null = null;
  static shouldFail = false;
  static failureReason = 'Mock failure';

  async sendMessage(phoneNumber: string, message: any, phoneNumberId: string): Promise<string | null> {
    MockWhatsAppSender.lastMessage = message;
    MockWhatsAppSender.lastPhoneNumber = phoneNumber;
    
    if (MockWhatsAppSender.shouldFail) {
      throw new Error(MockWhatsAppSender.failureReason);
    }
    
    return `mock-message-id-${Date.now()}`;
  }

  static reset() {
    this.lastMessage = null;
    this.lastPhoneNumber = null;
    this.shouldFail = false;
    this.failureReason = 'Mock failure';
  }
}

/**
 * Test utilities for database operations
 */
export const TestUtils = {
  /**
   * Create a test notification record directly
   */
  async createTestNotification(chatSessionId: string | null = null) {
    const { Notification } = await import('@/lib/database/models/notification');
    
    return await Notification.create({
      businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
      chatSessionId: chatSessionId,
      message: 'Test notification message',
      status: 'pending',
      notificationType: 'booking'
    });
  },

  /**
   * Clean up test data
   */
  async cleanupTestData() {
    const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
    const supa = getEnvironmentServiceRoleClient();
    
    // Clean up test notifications
    await supa
      .from('notifications')
      .delete()
      .ilike('message', '%test%');
  },

  /**
   * Generate test booking details
   */
  generateTestBookingDetails(overrides: any = {}) {
    return {
      bookingId: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.ID,
      customerName: NOTIFICATION_TEST_CONFIG.TEST_CUSTOMER_USER.NAME,
      customerPhone: NOTIFICATION_TEST_CONFIG.TEST_CUSTOMER_USER.PHONE,
      serviceName: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.SERVICE_NAME,
      servicesDisplay: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.SERVICE_NAME,
      isMultiService: false,
      formattedDate: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.FORMATTED_DATE,
      formattedTime: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.FORMATTED_TIME,
      location: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.LOCATION,
      totalCost: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.TOTAL_COST,
      amountPaid: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.AMOUNT_PAID,
      amountOwed: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.AMOUNT_OWED,
      ...overrides
    };
  }
}; 