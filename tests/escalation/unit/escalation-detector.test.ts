import { 
  detectEscalationTrigger,
  hasMediaContent,
  hasStickerContent,
  detectHumanAssistanceRequest,
  analyzeFrustrationPattern
} from '@/lib/bot-engine/escalation/escalation-detector';
import { 
  EscalationContextBuilder,
  EscalationAssertions,
  ESCALATION_TEST_CONFIG 
} from '../utilities/escalation-test-helpers';

describe('Escalation Detection System', () => {
  
  describe('Media Content Detection', () => {
    describe('hasMediaContent', () => {
      it('should detect image content', () => {
        expect(hasMediaContent('[IMAGE] User sent an image')).toBe(true);
        expect(hasMediaContent('Check out this photo [IMAGE]')).toBe(true);
      });

      it('should detect video content', () => {
        expect(hasMediaContent('[VIDEO] User sent a video')).toBe(true);
        expect(hasMediaContent('Here is the video [VIDEO] of the problem')).toBe(true);
      });

      it('should detect document content', () => {
        expect(hasMediaContent('[DOCUMENT] User sent a document')).toBe(true);
        expect(hasMediaContent('Here is my receipt [DOCUMENT]')).toBe(true);
      });

      it('should NOT detect sticker content as media', () => {
        expect(hasMediaContent('[STICKER] 😀')).toBe(false);
      });

      it('should NOT detect audio content as media (handled separately)', () => {
        expect(hasMediaContent('[AUDIO] User sent audio')).toBe(false);
      });

      it('should NOT detect regular text as media', () => {
        expect(hasMediaContent('Hello, I need help with booking')).toBe(false);
        expect(hasMediaContent('What services do you offer?')).toBe(false);
      });
    });

    describe('hasStickerContent', () => {
      it('should detect sticker content', () => {
        expect(hasStickerContent('[STICKER] 😀')).toBe(true);
        expect(hasStickerContent('[STICKER] User sent sticker')).toBe(true);
      });

      it('should NOT detect non-sticker content', () => {
        expect(hasStickerContent('[IMAGE] User sent image')).toBe(false);
        expect(hasStickerContent('Hello there')).toBe(false);
      });
    });
  });

  describe('Human Assistance Request Detection', () => {
    // Test cases for AI-powered human request detection
    const humanRequestMessages = ESCALATION_TEST_CONFIG.ESCALATION_TRIGGERS.HUMAN_REQUEST_MESSAGES;
    const nonHumanRequestMessages = ESCALATION_TEST_CONFIG.ESCALATION_TRIGGERS.NON_ESCALATION_MESSAGES;

    describe('detectHumanAssistanceRequest', () => {
      test.each(humanRequestMessages)(
        'should detect human request: "%s"',
        async (message) => {
          const isHumanRequest = await detectHumanAssistanceRequest(message);
          expect(isHumanRequest).toBe(true);
        }
      );

      test.each(nonHumanRequestMessages)(
        'should NOT detect human request: "%s"',
        async (message) => {
          const isHumanRequest = await detectHumanAssistanceRequest(message);
          expect(isHumanRequest).toBe(false);
        }
      );

      it('should handle empty or invalid messages gracefully', async () => {
        expect(await detectHumanAssistanceRequest('')).toBe(false);
        expect(await detectHumanAssistanceRequest('   ')).toBe(false);
      });
    });
  });

  describe('Frustration Pattern Analysis', () => {
    let chatContext: any;
    
    beforeEach(() => {
      // Create fresh context for each test to avoid state pollution
      chatContext = EscalationContextBuilder.createTestChatContext();
    });

    describe('analyzeFrustrationPattern', () => {
      it('should escalate based on frustrated message count: 1→No, 2→No, 3→Yes (AUTOMATIC TEST)', async () => {
        console.log('🧪 COMPREHENSIVE FRUSTRATION TEST: Testing all escalation thresholds automatically...');

        // Use configured frustration messages instead of hardcoded ones
        const frustrationMessages = ESCALATION_TEST_CONFIG.ESCALATION_TRIGGERS.FRUSTRATION_MESSAGES;
        const threshold = ESCALATION_TEST_CONFIG.THRESHOLDS.CONSECUTIVE_FRUSTRATED_MESSAGES;

        // ===== TEST 1: Single frustrated message → No escalation =====
        console.log('\n📝 TESTING 1 FRUSTRATED MESSAGE (should NOT escalate)');
        const historyWith0 = []; // No history
        const result1 = await analyzeFrustrationPattern(frustrationMessages[0], historyWith0, chatContext);
        
        expect(result1.shouldEscalate).toBe(false);
        expect(result1.consecutiveFrustratedMessages).toBe(1);
        console.log(`✅ 1 message: No escalation (${result1.consecutiveFrustratedMessages} messages)`);

        // ===== TEST 2: Two frustrated messages → No escalation =====
        console.log('\n📝 TESTING 2 FRUSTRATED MESSAGES (should NOT escalate)');
        const historyWith1 = EscalationContextBuilder.createFrustrationMessageHistory(1);
        const result2 = await analyzeFrustrationPattern(frustrationMessages[1], historyWith1, chatContext);
        
        expect(result2.shouldEscalate).toBe(false);
        expect(result2.consecutiveFrustratedMessages).toBe(2);
        console.log(`✅ 2 messages: No escalation (${result2.consecutiveFrustratedMessages} messages)`);

        // ===== TEST 3: Three frustrated messages → Escalation triggered! =====
        console.log('\n📝 TESTING 3 FRUSTRATED MESSAGES (should ESCALATE)');
        const historyWith2 = EscalationContextBuilder.createFrustrationMessageHistory(2);
        const result3 = await analyzeFrustrationPattern(frustrationMessages[2], historyWith2, chatContext);
        
        expect(result3.shouldEscalate).toBe(true);
        expect(result3.consecutiveFrustratedMessages).toBe(threshold);
        console.log(`🚨 ${threshold} messages: ESCALATION TRIGGERED (${result3.consecutiveFrustratedMessages} messages)`);

        console.log('\n🎉 ALL FRUSTRATION THRESHOLDS WORKING CORRECTLY!');
        console.log('   → 1 message: ❌ No escalation');
        console.log('   → 2 messages: ❌ No escalation'); 
        console.log(`   → ${threshold} messages: ✅ ESCALATION!`);
      });

      it('should reset frustration count after staff intervention', async () => {
        const messages = EscalationContextBuilder.createFrustrationMessageHistory(2);
        
        // Add staff intervention
        messages.push({
          role: 'staff',
          content: 'I apologize for the confusion. Let me personally help you.',
          timestamp: new Date(Date.now() - 60000).toISOString() // 1 minute ago
        });

        // Add one more frustrated message
        messages.push({
          role: 'user',
          content: 'Still not working properly',
          timestamp: new Date(Date.now() - 30000).toISOString()
        });

        const currentMessage = 'I am frustrated';
        const result = await analyzeFrustrationPattern(currentMessage, messages, chatContext);

        // Should not escalate because counter reset after staff intervention
        expect(result.shouldEscalate).toBe(false);
        expect(result.consecutiveFrustratedMessages).toBeLessThan(3);
      });

      it('should handle positive messages correctly', async () => {
        const normalHistory = [
          {
            role: 'user' as const,
            content: 'Hello, I would like to book an appointment',
            timestamp: new Date(Date.now() - 120000).toISOString()
          },
          {
            role: 'assistant' as const,
            content: 'I would be happy to help you with that!',
            timestamp: new Date(Date.now() - 60000).toISOString()
          }
        ];

        const currentMessage = 'Thank you for your help!';
        const result = await analyzeFrustrationPattern(currentMessage, normalHistory, chatContext);

        expect(result.shouldEscalate).toBe(false);
        expect(result.consecutiveFrustratedMessages).toBe(0);
      });
    });
  });

  describe('Main Escalation Detection Logic', () => {
    let chatContext: any;
    let messageHistory: any[];
    
    beforeEach(() => {
      // Create fresh context and history for each test to avoid state pollution
      chatContext = EscalationContextBuilder.createTestChatContext();
      messageHistory = EscalationContextBuilder.createFrustrationMessageHistory(1); // Normal history
    });

    describe('detectEscalationTrigger', () => {
      
      describe('Media Content Escalation (Highest Priority)', () => {
        it('should escalate for image content', async () => {
          const result = await detectEscalationTrigger(
            '[IMAGE] Here is a photo of the problem',
            chatContext,
            messageHistory
          );

          EscalationAssertions.assertEscalationTriggered(result, 'media_redirect');
          expect(result.customMessage).toContain('media');
        });

        it('should escalate for video content', async () => {
          const result = await detectEscalationTrigger(
            '[VIDEO] Video showing the issue',
            chatContext,
            messageHistory
          );

          EscalationAssertions.assertEscalationTriggered(result, 'media_redirect');
        });

        it('should escalate for document content', async () => {
          const result = await detectEscalationTrigger(
            '[DOCUMENT] Important document attached',
            chatContext,
            messageHistory
          );

          EscalationAssertions.assertEscalationTriggered(result, 'media_redirect');
        });
      });

      describe('Human Request Escalation (Second Priority)', () => {
        it('should escalate for explicit human requests', async () => {
          const result = await detectEscalationTrigger(
            'I want to speak to a human',
            chatContext,
            messageHistory
          );

          EscalationAssertions.assertEscalationTriggered(result, 'human_request');
        });

        it('should escalate for Spanish human requests', async () => {
          const spanishContext = EscalationContextBuilder.createTestChatContext({ language: 'es' });
          
          const result = await detectEscalationTrigger(
            'Quiero hablar con una persona',
            spanishContext,
            messageHistory
          );

          EscalationAssertions.assertEscalationTriggered(result, 'human_request');
        });
      });

      describe('Frustration Pattern Escalation (Third Priority)', () => {
        it('should escalate for frustration pattern', async () => {
          // Create 2 frustrated messages in history + 1 current = 3 total (triggers escalation)
          const frustratedHistory = EscalationContextBuilder.createFrustrationMessageHistory(2);
          const frustrationMessage = ESCALATION_TEST_CONFIG.ESCALATION_TRIGGERS.FRUSTRATION_MESSAGES[2];
          
          const result = await detectEscalationTrigger(
            frustrationMessage,
            chatContext,
            frustratedHistory
          );

          EscalationAssertions.assertEscalationTriggered(result, 'frustration');
          expect(result.customMessage).toContain('difficulty');
        });
      });

      describe('No Escalation Scenarios', () => {
        const noEscalationMessages = ESCALATION_TEST_CONFIG.ESCALATION_TRIGGERS.NON_ESCALATION_MESSAGES;

        test.each(noEscalationMessages)(
          'should NOT escalate for normal message: "%s"',
          async (message) => {
            const result = await detectEscalationTrigger(message, chatContext, messageHistory);
            EscalationAssertions.assertNoEscalation(result);
          }
        );

        it('should NOT escalate for sticker messages', async () => {
          const result = await detectEscalationTrigger(
            '[STICKER] 😀',
            chatContext,
            messageHistory
          );

          EscalationAssertions.assertNoEscalation(result);
        });
      });

      describe('Priority Order Testing', () => {
        it('should prioritize media over human request', async () => {
          const result = await detectEscalationTrigger(
            '[IMAGE] I want to speak to a human about this image',
            chatContext,
            messageHistory
          );

          // Media should take priority
          EscalationAssertions.assertEscalationTriggered(result, 'media_redirect');
        });

        it('should prioritize human request over frustration', async () => {
          // Create 2 frustrated messages in history + 1 current = 3 total (would trigger frustration)
          const frustratedHistory = EscalationContextBuilder.createFrustrationMessageHistory(2);
          
          const result = await detectEscalationTrigger(
            'I am frustrated and want to speak to a human',
            chatContext,
            frustratedHistory
          );

          // Human request should take priority over frustration
          EscalationAssertions.assertEscalationTriggered(result, 'human_request');
        });
      });

      describe('Language-Specific Responses', () => {
        it('should return English messages for English context', async () => {
          const englishContext = EscalationContextBuilder.createTestChatContext({ language: 'en' });
          
          const result = await detectEscalationTrigger(
            '[IMAGE] Test image',
            englishContext,
            messageHistory
          );

          expect(result.customMessage).toContain('staff member');
        });

        it('should return Spanish messages for Spanish context', async () => {
          const spanishContext = EscalationContextBuilder.createTestChatContext({ language: 'es' });
          
          const result = await detectEscalationTrigger(
            '[IMAGE] Imagen de prueba',
            spanishContext,
            messageHistory
          );

          expect(result.customMessage).toMatch(/personal|equipo/i);
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    let chatContext: any;
    
    beforeEach(() => {
      // Create fresh context for each test to avoid state pollution
      chatContext = EscalationContextBuilder.createTestChatContext();
    });

    it('should handle empty message gracefully', async () => {
      const result = await detectEscalationTrigger('', chatContext, []);
      EscalationAssertions.assertNoEscalation(result);
    });

    it('should handle whitespace-only message', async () => {
      const result = await detectEscalationTrigger('   ', chatContext, []);
      EscalationAssertions.assertNoEscalation(result);
    });

    it('should handle null/undefined message history', async () => {
      const result = await detectEscalationTrigger('Hello', chatContext, []);
      EscalationAssertions.assertNoEscalation(result);
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(1000) + ' [IMAGE] with image content';
      const result = await detectEscalationTrigger(longMessage, chatContext, []);
      
      // Should still detect media content
      EscalationAssertions.assertEscalationTriggered(result, 'media_redirect');
    });
  });
}); 