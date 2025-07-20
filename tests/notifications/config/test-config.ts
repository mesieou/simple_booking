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

  // Test Session Data
  TEST_SESSION: {
    ID: randomUUID(),
    CUSTOMER_PHONE: '+61452490450'
  },

  // Test Booking Data
  TEST_BOOKING: {
    ID: 'bk_' + randomUUID().substring(0, 8),
    SERVICE_NAME: 'Gel Manicure',
    DATE: '2025-07-21',
    TIME: '08:00',
    COST: 44.00,
    PAID: 24.00,
    OWED: 20.00
  },

  // Mock Recipients for Template Testing
  MOCK_RECIPIENTS: {
    ADMIN: {
      userId: 'e4112649-a883-4f4d-a8f5-3f71cadf0863',
      phoneNumber: '+61452678816',
      name: 'Luisa Bernal',
      role: 'admin',
      isBusinessAdmin: true,
      isSuperAdmin: false
    },
    SUPER_ADMIN: {
      userId: 'c9107c0b-a48f-4925-8ec9-52fcf4bfdaco',
      phoneNumber: '+61450549485',
      name: 'juan bernal',
      role: 'super_admin',
      isBusinessAdmin: false,
      isSuperAdmin: true
    }
  },

  // Expected Message Content
  EXPECTED_MESSAGES: {
    BOOKING_NOTIFICATION_TITLE: '🎉 New Booking Confirmed!',
    FEEDBACK_NOTIFICATION_TITLE: '⚠️ Negative Feedback Alert',
    ESCALATION_NOTIFICATION_TITLE: '🚨 Human Assistance Required 🚨'
  }
};

/**
 * Mock WhatsApp Sender for testing templates
 */
export class MockWhatsAppSender {
  private static templateCalls: Array<{
    recipientPhone: string;
    templateName: string;
    languageCode: string;
    bodyParams: string[];
    businessPhoneNumberId: string;
    headerParams: string[];
    headerMedia?: any;
  }> = [];
  
  private static regularCalls: Array<{
    recipientPhone: string;
    message: any;
    businessPhoneNumberId: string;
  }> = [];
  
  private static shouldSucceed = true;
  private static successMessageId = 'wamid_mock_success';
  private static errorMessage = 'Mock template error';

  static reset() {
    this.templateCalls = [];
    this.regularCalls = [];
    this.shouldSucceed = true;
    this.successMessageId = 'wamid_mock_success';
    this.errorMessage = 'Mock template error';
  }

  static mockTemplateSuccess(messageId: string) {
    this.shouldSucceed = true;
    this.successMessageId = messageId;
  }

  static mockTemplateError(error: string) {
    this.shouldSucceed = false;
    this.errorMessage = error;
  }

  static getTemplateCalls() {
    return this.templateCalls;
  }

  static getRegularCalls() {
    return this.regularCalls;
  }

  // Mock sendTemplateMessage method
  async sendTemplateMessage(
    recipientId: string,
    templateName: string,
    languageCode: string,
    bodyParameters: string[],
    businessPhoneNumberId: string,
    headerParameters: string[] = [],
    headerMedia?: any
  ): Promise<string | null> {
    
    // Record the call
    MockWhatsAppSender.templateCalls.push({
      recipientPhone: recipientId,
      templateName,
      languageCode,
      bodyParams: bodyParameters,
      businessPhoneNumberId,
      headerParams: headerParameters,
      headerMedia
    });

    if (!MockWhatsAppSender.shouldSucceed) {
      throw new Error(MockWhatsAppSender.errorMessage);
    }

    return MockWhatsAppSender.successMessageId;
  }

  // Mock regular sendMessage method
  async sendMessage(
    recipientId: string,
    message: any,
    businessPhoneNumberId: string
  ): Promise<string | null> {
    
    // Record the call
    MockWhatsAppSender.regularCalls.push({
      recipientPhone: recipientId,
      message,
      businessPhoneNumberId
    });

    if (!MockWhatsAppSender.shouldSucceed) {
      throw new Error(MockWhatsAppSender.errorMessage);
    }

    return MockWhatsAppSender.successMessageId;
  }
}

/**
 * Test utilities for notification testing
 */
export class TestUtils {
  
  /**
   * Clean up test data from database
   */
  static async cleanupTestData(): Promise<void> {
    try {
      const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
      const supa = getEnvironmentServiceRoleClient();
      
      // Clean up test notifications
      await supa
        .from('notifications')
        .delete()
        .eq('businessId', NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes
      
    } catch (error) {
      console.warn('[TestUtils] Could not clean up test data:', error);
    }
  }

  /**
   * Get recent notifications for testing
   */
  static async getRecentNotifications(): Promise<Array<{
    id: string;
    businessId: string;
    chatSessionId: string | null;
    message: string;
    status: string;
    notificationType: string;
    createdAt: string;
  }>> {
    try {
      const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
      const supa = getEnvironmentServiceRoleClient();
      
      const { data, error } = await supa
        .from('notifications')
        .select('*')
        .eq('businessId', NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[TestUtils] Error fetching recent notifications:', error);
        return [];
      }
      
      return (data || []).map(row => ({
        id: row.id,
        businessId: row.businessId,
        chatSessionId: row.chatSessionId,
        message: row.message,
        status: row.status,
        notificationType: row.notificationType || 'escalation',
        createdAt: row.created_at
      }));
      
    } catch (error) {
      console.error('[TestUtils] Exception fetching recent notifications:', error);
      return [];
    }
  }

  /**
   * Generate test booking details for consistent testing
   */
  static generateTestBookingDetails() {
    return {
      bookingId: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.ID,
      customerName: NOTIFICATION_TEST_CONFIG.TEST_CUSTOMER_USER.NAME,
      customerPhone: NOTIFICATION_TEST_CONFIG.TEST_CUSTOMER_USER.PHONE,
      serviceName: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.SERVICE_NAME,
      servicesDisplay: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.SERVICE_NAME,
      isMultiService: false,
      formattedDate: 'July 21, 2025',
      formattedTime: '8:00 AM',
      location: 'Apt 111, 9 Dryburgh st, West Melbourne, VIC 3003',
      totalCost: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.COST,
      amountPaid: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.PAID,
      amountOwed: NOTIFICATION_TEST_CONFIG.TEST_BOOKING.OWED
    };
  }

  /**
   * Generate test feedback details for consistent testing
   */
  static generateTestFeedbackDetails() {
    return {
      customerName: NOTIFICATION_TEST_CONFIG.TEST_CUSTOMER_USER.NAME,
      feedbackText: 'The service was not what I expected and I am disappointed.',
      businessName: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.NAME,
      timestamp: new Date().toLocaleDateString()
    };
  }

  /**
   * Validate template call structure
   */
  static validateTemplateCall(call: any, expectedTemplate: string, expectedHeaderCount: number, expectedBodyCount: number) {
    expect(call).toBeDefined();
    expect(call.templateName).toBe(expectedTemplate);
    expect(call.languageCode).toBe('en');
    expect(call.headerParams).toHaveLength(expectedHeaderCount);
    expect(call.bodyParams).toHaveLength(expectedBodyCount);
    
    // Validate no empty parameters
    for (const param of call.headerParams) {
      expect(param).toBeTruthy();
      expect(param.trim().length).toBeGreaterThan(0);
    }
    
    for (const param of call.bodyParams) {
      expect(param).toBeTruthy();
      expect(param.trim().length).toBeGreaterThan(0);
    }
  }

  /**
   * Validate WhatsApp parameter compliance
   */
  static validateWhatsAppCompliance(params: string[]) {
    for (const param of params) {
      // Check for forbidden characters
      expect(param).not.toContain('\n');
      expect(param).not.toContain('\t');
      
      // Check length limits
      expect(param.length).toBeLessThanOrEqual(1024);
      
      // Check for excessive spaces
      expect(param).not.toMatch(/\s{4,}/);
    }
  }

  /**
   * Wait for async operations to complete
   */
  static async waitForAsync(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a test notification directly in database
   */
  static async createTestNotification(type: 'booking' | 'system' | 'escalation', chatSessionId?: string) {
    const { Notification } = await import('@/lib/database/models/notification');
    
    return await Notification.create({
      businessId: NOTIFICATION_TEST_CONFIG.TEST_BUSINESS.ID,
      chatSessionId: chatSessionId || null,
      message: `Test ${type} notification`,
      status: 'pending',
      notificationType: type
    });
  }
} 