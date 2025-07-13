/**
 * Proxy Test Builders
 * Utility functions for creating proxy-related test data and scenarios
 */

import { 
  ESCALATION_TEST_CONFIG,
  createTestNotificationId,
  createTestSessionId 
} from '../config/escalation-test-config';
import type { ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import type { ProxySession, ProxySessionData } from '@/lib/bot-engine/escalation/types';

/**
 * Proxy Message Builders
 */
export class ProxyMessageBuilder {
  /**
   * Creates admin message to end proxy session
   */
  static createEndProxyMessage(
    adminPhone: string = ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE,
    method: 'text' | 'button' = 'button'
  ): ParsedMessage {
    if (method === 'button') {
      return {
        text: 'Return control to bot',
        senderId: adminPhone,
        recipientId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        messageId: `end_proxy_btn_${Date.now()}`,
        timestamp: new Date(),
        businessWhatsappNumber: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
        customerWhatsappNumber: adminPhone,
        channelType: 'whatsapp' as const,
        attachments: [{
          type: 'interactive_reply',
          payload: {
            payload: 'Return control to bot',
            text: 'Return control to bot'
          }
        }],
        originalPayload: {
          object: 'whatsapp_business_account',
          entry: [{
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
                  phone_number_id: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
                },
                messages: [{
                  from: adminPhone,
                  id: `end_proxy_btn_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'button',
                  button: {
                    payload: 'Return control to bot',
                    text: 'Return control to bot'
                  }
                }]
              }
            }]
          }]
        }
      };
    } else {
      return {
        text: 'return control to bot',
        senderId: adminPhone,
        recipientId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        messageId: `end_proxy_text_${Date.now()}`,
        timestamp: new Date(),
        businessWhatsappNumber: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
        customerWhatsappNumber: adminPhone,
        channelType: 'whatsapp' as const,
        originalPayload: {
          object: 'whatsapp_business_account',
          entry: [{
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
                  phone_number_id: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
                },
                messages: [{
                  from: adminPhone,
                  id: `end_proxy_text_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text',
                  text: { body: 'return control to bot' }
                }]
              }
            }]
          }]
        }
      };
    }
  }

  /**
   * Creates admin message for proxy conversation
   */
  static createAdminProxyMessage(
    text: string,
    adminPhone: string = ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE
  ): ParsedMessage {
    return {
      text,
      senderId: adminPhone,
      recipientId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
      messageId: `admin_proxy_${Date.now()}`,
      timestamp: new Date(),
      businessWhatsappNumber: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
      customerWhatsappNumber: adminPhone,
      channelType: 'whatsapp' as const,
      originalPayload: {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
                phone_number_id: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
              },
              messages: [{
                from: adminPhone,
                id: `admin_proxy_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: { body: text }
              }]
            }
          }]
        }]
      }
    };
  }

  /**
   * Creates customer message during proxy session
   */
  static createCustomerProxyMessage(
    text: string,
    customerPhone: string = ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE
  ): ParsedMessage {
    return {
      text,
      senderId: customerPhone,
      recipientId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
      messageId: `customer_proxy_${Date.now()}`,
      timestamp: new Date(),
      businessWhatsappNumber: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
      customerWhatsappNumber: customerPhone,
      channelType: 'whatsapp' as const,
      originalPayload: {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
                phone_number_id: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
              },
              messages: [{
                from: customerPhone,
                id: `customer_proxy_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: { body: text }
              }]
            }
          }]
        }]
      }
    };
  }
}

/**
 * Proxy Session Builders
 */
export class ProxySessionBuilder {
  /**
   * Creates a mock proxy session
   */
  static createMockProxySession(
    overrides: Partial<ProxySession> = {}
  ): ProxySession {
    return {
      notificationId: createTestNotificationId(),
      sessionId: createTestSessionId(),
      adminPhone: ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE,
      customerPhone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      businessPhoneNumberId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
      isActive: true,
      startedAt: new Date().toISOString(),
      templateMessageId: `template-msg-${Date.now()}`,
      ...overrides
    };
  }

  /**
   * Creates proxy session data for database storage
   */
  static createProxySessionData(
    overrides: Partial<ProxySessionData> = {}
  ): ProxySessionData {
    return {
      adminPhone: ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE,
      customerPhone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      templateMessageId: `template-msg-${Date.now()}`,
      startedAt: new Date().toISOString(),
      ...overrides
    };
  }
}

/**
 * Proxy Test Scenarios
 */
export class ProxyScenarioBuilder {
  /**
   * Complete proxy escalation scenario
   */
  static async createCompleteProxyScenario(): Promise<{
    customerEscalation: ParsedMessage;
    adminProxyMessage: ParsedMessage;
    customerProxyResponse: ParsedMessage;
    adminEndProxy: ParsedMessage;
    customerAfterProxy: ParsedMessage;
  }> {
    const customerPhone = ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE;
    const adminPhone = ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE;

    return {
      // 1. Customer escalates
      customerEscalation: ProxyMessageBuilder.createCustomerProxyMessage(
        "I need to speak to someone",
        customerPhone
      ),
      
      // 2. Admin responds in proxy
      adminProxyMessage: ProxyMessageBuilder.createAdminProxyMessage(
        "Hi! I'm here to help. What can I do for you?",
        adminPhone
      ),
      
      // 3. Customer responds during proxy
      customerProxyResponse: ProxyMessageBuilder.createCustomerProxyMessage(
        "Thank you! I need help with my booking",
        customerPhone
      ),
      
      // 4. Admin ends proxy
      adminEndProxy: ProxyMessageBuilder.createEndProxyMessage(
        adminPhone,
        'button'
      ),
      
      // 5. Customer messages after proxy ended
      customerAfterProxy: ProxyMessageBuilder.createCustomerProxyMessage(
        "Hello again",
        customerPhone
      )
    };
  }

  /**
   * Multiple customer escalation scenario
   */
  static async createMultipleCustomerScenario(): Promise<{
    customer1Escalation: ParsedMessage;
    customer2Escalation: ParsedMessage;
    adminRespondsToCustomer1: ParsedMessage;
    adminEndsCustomer1Proxy: ParsedMessage;
    adminRespondsToCustomer2: ParsedMessage;
  }> {
    const customer1Phone = ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE;
    const customer2Phone = '+61400000002'; // Second test customer phone
    const adminPhone = ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE;

    return {
      // Customer 1 escalates
      customer1Escalation: ProxyMessageBuilder.createCustomerProxyMessage(
        "I need help with my booking",
        customer1Phone
      ),
      
      // Customer 2 escalates (while Customer 1 in proxy)
      customer2Escalation: ProxyMessageBuilder.createCustomerProxyMessage(
        "Can someone assist me?",
        customer2Phone
      ),
      
      // Admin responds to Customer 1
      adminRespondsToCustomer1: ProxyMessageBuilder.createAdminProxyMessage(
        "Sure! What do you need help with?",
        adminPhone
      ),
      
      // Admin ends Customer 1 proxy
      adminEndsCustomer1Proxy: ProxyMessageBuilder.createEndProxyMessage(
        adminPhone,
        'button'
      ),
      
      // Admin responds to Customer 2 (new proxy session)
      adminRespondsToCustomer2: ProxyMessageBuilder.createAdminProxyMessage(
        "Hi there! How can I help you?",
        adminPhone
      )
    };
  }
}

/**
 * Test Expectations for Proxy Functionality
 */
export class ProxyExpectations {
  /**
   * Expects proxy session to be created
   */
  static expectProxySessionCreated(
    session: ProxySession,
    expectedAdminPhone: string,
    expectedCustomerPhone: string
  ): void {
    expect(session).toBeDefined();
    expect(session.isActive).toBe(true);
    expect(session.adminPhone).toBe(expectedAdminPhone);
    expect(session.customerPhone).toBe(expectedCustomerPhone);
    expect(session.startedAt).toBeDefined();
  }

  /**
   * Expects proxy session to be ended
   */
  static expectProxySessionEnded(
    session: ProxySession | null
  ): void {
    expect(session).toBeNull();
  }

  /**
   * Expects message to be forwarded in proxy
   */
  static expectMessageForwarded(
    result: any,
    expectedDirection: 'Admin→Customer' | 'Customer→Admin'
  ): void {
    expect(result.wasHandled).toBe(true);
    expect(result.messageForwarded).toBe(true);
    expect(result.proxyEnded).toBe(false);
  }

  /**
   * Expects proxy session to end successfully
   */
  static expectProxyEnded(
    result: any,
    expectedConfirmation: boolean = true
  ): void {
    expect(result.wasHandled).toBe(true);
    expect(result.messageForwarded).toBe(false);
    expect(result.proxyEnded).toBe(true);
    
    if (expectedConfirmation) {
      expect(result.response).toBeDefined();
      expect(result.response?.text).toContain('Proxy mode ended');
    }
  }
}

/**
 * Test Database Helpers for Proxy
 */
export class ProxyTestDb {
  /**
   * Creates test notification in proxy mode
   */
  static async createTestProxyNotification(
    sessionId: string,
    businessId: string,
    adminPhone: string
  ): Promise<string> {
    const { Notification } = await import('@/lib/database/models/notification');
    const { ChatSession } = await import('@/lib/database/models/chat-session');
    
    // First create a valid chat session
    const chatSession = await ChatSession.create({
      businessId,
      channel: 'whatsapp',
      channelUserId: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      status: 'active'
    });
    
    const notification = await Notification.create({
      businessId,
      chatSessionId: chatSession.id,
      message: 'Test proxy escalation',
      status: 'pending'
    });
    
    // Update with proxy session data
    await Notification.updateStatusToProxyMode(notification.id, {
      adminPhone,
      customerPhone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      templateMessageId: `test-template-${Date.now()}`,
      startedAt: new Date().toISOString()
    });
    
    return notification.id;
  }

  /**
   * Cleans up test proxy sessions
   */
  static async cleanupTestProxySessions(): Promise<void> {
    const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
    const supa = getEnvironmentServiceRoleClient();
    
    // Clean up test notifications
    await supa
      .from('notifications')
      .delete()
      .ilike('message', '%test%');
    
    // Clean up test chat sessions
    await supa
      .from('chatSessions')
      .delete()
      .eq('channelUserId', ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE)
      .eq('status', 'active');
  }
} 