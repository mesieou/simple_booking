import { 
  handleEscalationOrAdminCommand 
} from '@/lib/bot-engine/escalation/escalation-orchestrator';
import { 
  sendEscalationTemplateWithProxy 
} from '@/lib/bot-engine/escalation/proxy-escalation-handler';
import { 
  routeProxyMessage 
} from '@/lib/bot-engine/escalation/proxy-communication-router';
import { 
  getOrCreateChatContext 
} from '@/lib/bot-engine/session/session-manager';
import { 
  WhatsAppMessageBuilder,
  EscalationDatabaseHelpers,
  EscalationContextBuilder,
  EscalationAssertions,
  AsyncTestHelpers,
  ESCALATION_TEST_CONFIG 
} from '../utilities/escalation-test-helpers';
import { createTestNotificationId } from '../config/escalation-test-config';
import { UserContext } from '@/lib/database/models/user-context';

describe('Escalation Flow Integration Tests', () => {
  
  // Setup and cleanup
  beforeAll(async () => {
    // Initialize test environment with actual database data
    await EscalationDatabaseHelpers.initializeTestEnvironment();
  });

  beforeEach(async () => {
    await EscalationDatabaseHelpers.cleanupEscalationTestData();
  });

  afterEach(async () => {
    await EscalationDatabaseHelpers.cleanupEscalationTestData();
  });

  describe('Complete Escalation Flow', () => {
    
    it('should handle media content escalation end-to-end', async () => {
      // 1. SETUP: Create test context using REAL production function
      const participant = EscalationContextBuilder.createTestParticipant();
      
      // Use the real production function to create chat context (this creates ChatSession too)
      const { context: chatContext, sessionId: realSessionId, userContext, customerUser } = await getOrCreateChatContext(participant);
      
      console.log('🔍 DEBUG: Created real session ID:', realSessionId);
      console.log('🔍 DEBUG: Chat context session ID:', chatContext.currentConversationSession?.id);
      console.log('🔍 DEBUG: Customer user phone:', ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE);
      console.log('🔍 DEBUG: Admin user phone:', ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE);

      // 2. ESCALATION TRIGGER: Customer sends image
      console.log('🔍 Testing: Customer sends image message');
      const customerMessage = '[IMAGE] Here is a photo of the broken item';
      
      const escalationResult = await handleEscalationOrAdminCommand(
        customerMessage,
        participant,
        chatContext,
        userContext,
        [], // Message history
        { 
          id: ESCALATION_TEST_CONFIG.CUSTOMER_USER.ID,
          firstName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[0],
          lastName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[1] || '',
          phone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE
        }, // Customer user
        ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME
      );

      // 3. VERIFY ESCALATION TRIGGERED
      console.log('✅ Verifying escalation was triggered');
      EscalationAssertions.assertEscalationTriggered(escalationResult, 'media_redirect');
      expect(escalationResult.response?.text).toContain('media');

      // 4. VERIFY NOTIFICATION CREATED
      console.log('🔍 Checking notification creation');
      await AsyncTestHelpers.waitForCondition(async () => {
        const notification = await EscalationDatabaseHelpers.getLatestEscalationNotification();
        return notification !== null;
      });

      const notification = await EscalationDatabaseHelpers.getLatestEscalationNotification();
      EscalationAssertions.assertNotificationCreated(notification, 'proxy_mode');
      expect(notification.message).toContain('media_redirect');

      console.log('✅ Complete media escalation flow verified');
    }, ESCALATION_TEST_CONFIG.THRESHOLDS.TEST_TIMEOUT_MS);

    it('should handle human request escalation with Spanish language', async () => {
      // 1. SETUP: Spanish context
      const participant = EscalationContextBuilder.createTestParticipant();
      const { context: chatContext, sessionId: realSessionId, userContext, customerUser } = await getOrCreateChatContext(participant);
      
      // Force Spanish language in context
      chatContext.participantPreferences.language = 'es';

      // 2. ESCALATION TRIGGER: Customer requests human in Spanish
      console.log('🔍 Testing: Customer requests human help in Spanish');
      const customerMessage = 'Quiero hablar con una persona';
      
      const escalationResult = await handleEscalationOrAdminCommand(
        customerMessage,
        participant,
        chatContext,
        userContext,
        [],
        { 
          id: ESCALATION_TEST_CONFIG.CUSTOMER_USER.ID,
          firstName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[0],
          lastName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[1] || '',
          phone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE
        },
        ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME
      );

      // 3. VERIFY SPANISH ESCALATION
      console.log('✅ Verifying Spanish escalation response');
      EscalationAssertions.assertEscalationTriggered(escalationResult, 'human_request');
      expect(escalationResult.response?.text).toMatch(/español|equipo|conectarte/i);

      // 4. VERIFY NOTIFICATION WITH SPANISH CONTEXT
      const notification = await EscalationDatabaseHelpers.getLatestEscalationNotification();
      EscalationAssertions.assertNotificationCreated(notification, 'proxy_mode');

      console.log('✅ Spanish escalation flow verified');
    }, ESCALATION_TEST_CONFIG.THRESHOLDS.TEST_TIMEOUT_MS);

    it('should handle frustration pattern escalation', async () => {
      // 1. SETUP: Context with frustrated message history
      const participant = EscalationContextBuilder.createTestParticipant();
      const { context: chatContext, sessionId: realSessionId, userContext, customerUser } = await getOrCreateChatContext(participant);

      // 2. ESCALATION TRIGGER: Build up frustration pattern
      console.log('🔍 Testing: Building frustration pattern (3+ messages)');
      const frustratedHistory = EscalationContextBuilder.createFrustrationMessageHistory(3);
              const finalFrustratedMessage = ESCALATION_TEST_CONFIG.ESCALATION_TRIGGERS.FRUSTRATION_MESSAGES[2];
      
      const escalationResult = await handleEscalationOrAdminCommand(
        finalFrustratedMessage,
        participant,
        chatContext,
        userContext,
        frustratedHistory,
        { 
          id: ESCALATION_TEST_CONFIG.CUSTOMER_USER.ID,
          firstName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[0],
          lastName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[1] || '',
          phone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE
        },
        ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME
      );

      // 3. VERIFY FRUSTRATION ESCALATION
      console.log('✅ Verifying frustration escalation');
      EscalationAssertions.assertEscalationTriggered(escalationResult, 'frustration');
      expect(escalationResult.response?.text).toContain('difficulty');

      const notification = await EscalationDatabaseHelpers.getLatestEscalationNotification();
      EscalationAssertions.assertNotificationCreated(notification, 'proxy_mode');

      console.log('✅ Frustration escalation flow verified');
    }, ESCALATION_TEST_CONFIG.THRESHOLDS.TEST_TIMEOUT_MS);
  });

  describe('Proxy Communication Flow', () => {
    
    it('should enable proxy communication between admin and customer', async () => {
      // This test demonstrates the complete proxy flow but may not send real WhatsApp messages
      // in test environment - it focuses on the logic and database state changes

      console.log('🔍 Testing: Complete proxy communication flow');

      // Skip test if business doesn't have WhatsApp phone number ID configured
      if (!ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID) {
        console.log('⏭️ Skipping proxy communication test - business WhatsApp phone number ID not configured');
        return;
      }

      // 1. SETUP: Create escalation notification
      const participant = EscalationContextBuilder.createTestParticipant();
      const { context: chatContext, sessionId, userContext, customerUser } = await getOrCreateChatContext(participant);
      const notificationId = createTestNotificationId();

      // 2. PROXY SETUP: Start proxy mode with template
      console.log('📤 Starting proxy mode with template');
      const proxyResult = await sendEscalationTemplateWithProxy(
        ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE,
        ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME,
        'I need help with my booking',
        ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        sessionId,
        notificationId,
        'en'
      );

      // Note: In test environment, template sending might fail due to WhatsApp API restrictions
      // The test focuses on the logic flow rather than actual message delivery
      console.log('📧 Proxy setup result:', { 
        success: proxyResult.success,
        templateSent: proxyResult.templateSent,
        error: proxyResult.error 
      });

      // Only test admin message routing if proxy setup succeeded
      if (proxyResult.success) {
        // 3. ADMIN MESSAGE: Simulate admin sending message to customer
        console.log('👨‍💼 Testing admin message routing');
        const adminMessage = WhatsAppMessageBuilder.createAdminMessage(
          'Hi! I can help you with your booking issue.'
        );

        const adminRouteResult = await routeProxyMessage(
          adminMessage,
          ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
        );

        // Verify admin message was handled by proxy system
        expect(adminRouteResult.wasHandled).toBe(true);
        console.log('✅ Admin message routing verified');
      } else {
        console.log('⏭️ Skipping message routing tests - proxy setup failed');
      }

        // 4. CUSTOMER RESPONSE: Simulate customer responding (only if proxy succeeded)
        if (proxyResult.success) {
          console.log('👤 Testing customer message routing');
          const customerResponse = WhatsAppMessageBuilder.createCustomerTextMessage(
            'Thank you! I need to change my appointment time.'
          );

          const customerRouteResult = await routeProxyMessage(
            customerResponse,
            ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
          );

          // Verify customer message was handled
          expect(customerRouteResult.wasHandled).toBe(true);
          console.log('✅ Customer message routing verified');

          // 5. ADMIN TAKEOVER: Simulate admin ending proxy mode
          console.log('🔄 Testing admin takeover (ending proxy mode)');
          const takeoverMessage = WhatsAppMessageBuilder.createTakeoverButtonPress();

          const takeoverResult = await routeProxyMessage(
            takeoverMessage,
            ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID
          );

          // Verify proxy mode ended
          expect(takeoverResult.wasHandled).toBe(true);
          expect(takeoverResult.proxyEnded).toBe(true);
          console.log('✅ Proxy takeover verified');

          console.log('🎉 Complete proxy communication flow tested');
        } else {
          console.log('⏭️ Skipping customer response and takeover tests - proxy setup failed');
        }
    }, ESCALATION_TEST_CONFIG.THRESHOLDS.TEST_TIMEOUT_MS);
  });

  describe('Edge Cases and Error Scenarios', () => {
    
    it('should handle escalation with missing business information gracefully', async () => {
      // Test escalation with invalid business context
      const invalidContext = EscalationContextBuilder.createTestChatContext();
      invalidContext.currentParticipant.associatedBusinessId = 'invalid-business-id';
      
      const participant = EscalationContextBuilder.createTestParticipant();
      participant.associatedBusinessId = 'invalid-business-id';
      
      const userContext = new UserContext({
        id: 'test-invalid-business',
        businessId: 'invalid-business-id',
        sessionContext: {}
      });

      const escalationResult = await handleEscalationOrAdminCommand(
        '[IMAGE] Test image',
        participant,
        invalidContext,
        userContext,
        [],
        { 
          id: ESCALATION_TEST_CONFIG.CUSTOMER_USER.ID,
          firstName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[0],
          lastName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[1] || '',
          phone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE
        },
        ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME
      );

      // Should handle gracefully without throwing
      expect(escalationResult.isEscalated).toBe(false);
      console.log('✅ Invalid business scenario handled gracefully');
    });

    it('should not escalate for sticker messages', async () => {
      const participant = EscalationContextBuilder.createTestParticipant();
      const { context: chatContext, sessionId: realSessionId, userContext, customerUser } = await getOrCreateChatContext(participant);

      const escalationResult = await handleEscalationOrAdminCommand(
        '[STICKER] 😀',
        participant,
        chatContext,
        userContext,
        [],
        { 
          id: ESCALATION_TEST_CONFIG.CUSTOMER_USER.ID,
          firstName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[0],
          lastName: ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[1] || '',
          phone: ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE
        },
        ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID,
        ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME
      );

      // Stickers should NOT trigger escalation
      EscalationAssertions.assertNoEscalation(escalationResult);
      console.log('✅ Sticker message correctly ignored');
    });
  });
}); 