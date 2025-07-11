import { 
  ChatContext, 
  ConversationalParticipant, 
  ConversationalParticipantType,
  ChatConversationSession,
  UserGoal 
} from '@/lib/bot-engine/types';
import { ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { UserContext } from '@/lib/database/models/user-context';
import { Notification } from '@/lib/database/models/notification';
import { 
  ESCALATION_TEST_CONFIG, 
  initializeEscalationTestConfig 
} from '../config/escalation-test-config';
import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';

// Re-export the config so test files can import it from this central file
export { ESCALATION_TEST_CONFIG };

/**
 * WhatsApp Message Builders
 */
export class WhatsAppMessageBuilder {
  /**
   * Creates a text message from customer
   */
  static createCustomerTextMessage(
    text: string,
    options: {
      senderId?: string;
      userName?: string;
      messageId?: string;
      timestamp?: Date;
    } = {}
  ): ParsedMessage {
    return {
      text,
      senderId: options.senderId || ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      recipientId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
      messageId: options.messageId || `msg_${Date.now()}`,
      timestamp: options.timestamp || new Date(),
      userName: options.userName || ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME,
      businessWhatsappNumber: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
      customerWhatsappNumber: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      attachments: [],
      channelType: 'local_test' as const,
      originalPayload: {
        // Mock WhatsApp payload structure for testing
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
                from: options.senderId || ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
                id: options.messageId || `msg_${Date.now()}`,
                timestamp: Math.floor((options.timestamp || new Date()).getTime() / 1000).toString(),
                text: { body: text },
                type: 'text'
              }]
            }
          }]
        }]
      }
    };
  }

  /**
   * Creates a media message (image, video, document)
   */
  static createMediaMessage(
    mediaType: 'image' | 'video' | 'document',
    options: {
      caption?: string;
      senderId?: string;
      userName?: string;
    } = {}
  ): ParsedMessage {
    const mediaPlaceholder = `[${mediaType.toUpperCase()}]`;
    const text = options.caption 
      ? `${mediaPlaceholder} ${options.caption}`
      : `${mediaPlaceholder} User sent ${mediaType}`;

    return {
      ...this.createCustomerTextMessage(text, options),
              attachments: [{
          type: mediaType,
          payload: {
            url: `https://test-media.example.com/${mediaType}-${Date.now()}`,
            originalFilename: `test_${mediaType}.${mediaType === 'image' ? 'jpg' : 'mp4'}`
          },
          caption: options.caption
        }]
    };
  }

  /**
   * Creates a sticker message (should NOT trigger escalation)
   */
  static createStickerMessage(options: { senderId?: string } = {}): ParsedMessage {
    return this.createCustomerTextMessage('[STICKER] 😀', options);
  }

  /**
   * Creates an admin message (for proxy communication testing)
   */
  static createAdminMessage(
    text: string,
    options: {
      buttonId?: string;
      messageId?: string;
    } = {}
  ): ParsedMessage & { buttonId?: string } {
    const message: ParsedMessage & { buttonId?: string } = {
      text,
      senderId: ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE,
      recipientId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
      messageId: options.messageId || `admin_msg_${Date.now()}`,
      timestamp: new Date(),
      businessWhatsappNumber: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
      customerWhatsappNumber: ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE,
      attachments: [],
      channelType: 'local_test' as const,
      originalPayload: {
        // Mock WhatsApp payload structure for admin message testing
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
                from: ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE,
                id: options.messageId || `admin_msg_${Date.now()}`,
                timestamp: Math.floor(new Date().getTime() / 1000).toString(),
                text: { body: text },
                type: 'text'
              }]
            }
          }]
        }]
      }
    };

    // Add buttonId if provided (for test verification)
    if (options.buttonId) {
      message.buttonId = options.buttonId;
    }

    return message;
  }

  /**
   * Creates button press message (admin ending proxy mode)
   */
  static createTakeoverButtonPress(): ParsedMessage & { buttonId?: string } {
    return this.createAdminMessage('BUTTON_PRESS', {
      buttonId: ESCALATION_TEST_CONFIG.TEMPLATE_CONFIG.TAKEOVER_BUTTON_ID
    });
  }
}

/**
 * Database Test Helpers
 */
export class EscalationDatabaseHelpers {
  
  /**
   * Initializes the test environment with proper database validation
   * This replaces the hardcoded business creation approach
   */
  static async initializeTestEnvironment(): Promise<void> {
    console.log('🔧 Initializing escalation test environment...');
    
    try {
      // Initialize the test configuration with actual database data
      await initializeEscalationTestConfig();
      
      console.log('✅ Test environment initialized successfully');
      console.log('📊 Test configuration:');
      console.log(`  - Business: ${ESCALATION_TEST_CONFIG.LUISA_BUSINESS.NAME} (${ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID})`);
      console.log(`  - Admin: ${ESCALATION_TEST_CONFIG.ADMIN_USER.WHATSAPP_NAME} (${ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE})`);
      console.log(`  - Customer: ${ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME} (${ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE})`);
      
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      throw error;
    }
  }
  
  /**
   * Cleans up escalation test data
   */
  static async cleanupEscalationTestData(): Promise<void> {
    const supabase = getEnvironmentServiceRoleClient();
    
    try {
      // Delete test notifications
      await supabase
        .from('notifications')
        .delete()
        .eq('businessId', ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID)
        .like('message', '%test%');

      // Delete test chat sessions for customer
      await supabase
        .from('chatSessions')
        .delete()
        .eq('channelUserId', ESCALATION_TEST_CONFIG.CUSTOMER_USER.NORMALIZED_PHONE)
        .eq('channel', 'whatsapp');

      console.log('✅ Escalation test data cleanup completed');
    } catch (error) {
      console.error('❌ Error cleaning up escalation test data:', error);
      throw error;
    }
  }

  /**
   * Gets latest escalation notification for the business
   */
  static async getLatestEscalationNotification(): Promise<any | null> {
    const supabase = getEnvironmentServiceRoleClient();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('businessId', ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Gets notification by ID with full details
   */
  static async getNotificationById(notificationId: string): Promise<any | null> {
    const supabase = getEnvironmentServiceRoleClient();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (error) {
      console.error('Error fetching notification:', error);
      return null;
    }

    return data;
  }

  /**
   * Creates a test chat session for escalation testing
   */
  static async createTestChatSession(): Promise<string> {
    const supabase = getEnvironmentServiceRoleClient();
    
    const now = new Date().toISOString();
    const sessionData = {
      channel: 'whatsapp',
      channelUserId: ESCALATION_TEST_CONFIG.CUSTOMER_USER.NORMALIZED_PHONE,
      businessId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID,
      status: 'active',
      allMessages: [],
      createdAt: now,
      updatedAt: now
    };

    const { data, error } = await supabase
      .from('chatSessions')
      .insert(sessionData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating test chat session:', error);
      throw error;
    }

    return data.id;
  }
}

/**
 * Mock Context Builders
 */
export class EscalationContextBuilder {
  
  /**
   * Creates a test chat context for escalation scenarios
   */
  static createTestChatContext(options: {
    language?: 'en' | 'es';
    sessionId?: string;
    hasActiveGoal?: boolean;
  } = {}): ChatContext {
    const sessionId = options.sessionId || `test-session-${Date.now()}`;
    
    const activeGoals: UserGoal[] = options.hasActiveGoal ? [{
      goalType: 'serviceBooking',
      goalStatus: 'inProgress',
      flowKey: 'salonBookingCreation',
      currentStepIndex: 0,
      collectedData: {},
      messageHistory: []
    }] : [];

    return {
      currentConversationSession: {
        id: sessionId,
        participantId: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
        participantType: 'customer' as ConversationalParticipantType,
        sessionStatus: 'active',
        sessionStartTimestamp: new Date(),
        lastMessageTimestamp: new Date(),
        communicationChannel: 'whatsapp' as const,
        activeGoals
      } as ChatConversationSession,
      participantPreferences: {
        language: options.language || 'en',
        timezone: 'UTC',
        notificationSettings: {}
      },
      frequentlyDiscussedTopics: [],
      currentParticipant: this.createTestParticipant()
    };
  }

  /**
   * Creates a test participant (customer)
   */
  static createTestParticipant(): ConversationalParticipant {
    return {
      id: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      type: 'customer',
      businessWhatsappNumber: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER,
      customerWhatsappNumber: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE,
      associatedBusinessId: ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID,
      creationTimestamp: new Date(),
      lastUpdatedTimestamp: new Date()
    };
  }

  /**
   * Creates test message history for frustration analysis
   */
  static createFrustrationMessageHistory(frustratedMessageCount: number): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    // Add some normal conversation first
    messages.push({
      role: 'user',
      content: 'Hello, I want to book an appointment',
      timestamp: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
    });
    
    messages.push({
      role: 'bot',
      content: 'Hi! I can help you with that. What service would you like?',
      timestamp: new Date(Date.now() - 240000).toISOString() // 4 minutes ago
    });

    // Add frustrated messages
    const frustratedTexts = ESCALATION_TEST_CONFIG.ESCALATION_TRIGGERS.FRUSTRATION_MESSAGES;
    
    for (let i = 0; i < frustratedMessageCount; i++) {
      messages.push({
        role: 'user',
        content: frustratedTexts[i % frustratedTexts.length],
        timestamp: new Date(Date.now() - (180000 - i * 30000)).toISOString() // Spaced 30 seconds apart
      });
      
      // Add bot responses between frustrated messages
      if (i < frustratedMessageCount - 1) {
        messages.push({
          role: 'bot',
          content: 'I understand your concern. Let me help you with that.',
          timestamp: new Date(Date.now() - (165000 - i * 30000)).toISOString()
        });
      }
    }

    return messages;
  }
}

/**
 * Assertion Helpers
 */
export class EscalationAssertions {
  
  /**
   * Asserts that an escalation was triggered with the expected reason
   * Handles both EscalationTrigger and EscalationResult structures
   */
  static assertEscalationTriggered(
    escalationResult: any,
    expectedReason: 'media_redirect' | 'human_request' | 'frustration'
  ): void {
    // Handle EscalationTrigger structure (from detectEscalationTrigger)
    if ('shouldEscalate' in escalationResult) {
      expect(escalationResult.shouldEscalate).toBe(true);
      expect(escalationResult.reason).toBe(expectedReason);
      if (escalationResult.customMessage) {
        expect(escalationResult.customMessage).toBeTruthy();
      }
    } 
    // Handle EscalationResult structure (from handleEscalationOrAdminCommand)
    else {
      expect(escalationResult.isEscalated).toBe(true);
      expect(escalationResult.reason).toBe(expectedReason);
      expect(escalationResult.response).toBeDefined();
      expect(escalationResult.response.text).toBeTruthy();
    }
  }

  /**
   * Asserts that escalation was NOT triggered
   * Handles both EscalationTrigger and EscalationResult structures
   */
  static assertNoEscalation(escalationResult: any): void {
    // Handle EscalationTrigger structure (from detectEscalationTrigger)
    if ('shouldEscalate' in escalationResult) {
      expect(escalationResult.shouldEscalate).toBe(false);
      expect(escalationResult.reason).toBeUndefined();
    } 
    // Handle EscalationResult structure (from handleEscalationOrAdminCommand)
    else {
      expect(escalationResult.isEscalated).toBe(false);
      expect(escalationResult.reason).toBeUndefined();
    }
  }

  /**
   * Asserts notification was created with correct data
   */
  static assertNotificationCreated(
    notification: any,
    expectedStatus: string = 'pending'
  ): void {
    expect(notification).toBeDefined();
    expect(notification.id).toBeTruthy();
    expect(notification.businessId).toBe(ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID);
    expect(notification.status).toBe(expectedStatus);
    expect(notification.message).toBeTruthy();
  }

  /**
   * Asserts proxy mode is active
   */
  static assertProxyModeActive(notification: any): void {
    expect(notification.status).toBe('proxy_mode');
    expect(notification.deliveryStatus).toBe('sent');
    expect(notification.whatsappMessageId).toBeTruthy();
  }

  /**
   * Asserts proxy mode ended successfully
   */
  static assertProxyModeEnded(notification: any): void {
    expect(notification.status).toBe('provided_help');
  }
}

/**
 * Wait utilities for async testing
 */
export class AsyncTestHelpers {
  
  /**
   * Waits for a condition to be met with timeout
   */
  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeoutMs: number = ESCALATION_TEST_CONFIG.THRESHOLDS.TEST_TIMEOUT_MS,
    pollIntervalMs: number = 1000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return;
      }
      await this.delay(pollIntervalMs);
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Simple delay utility
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 