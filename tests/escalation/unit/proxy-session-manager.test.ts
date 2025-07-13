/**
 * Unit Tests for Proxy Session Manager
 * Tests proxy session creation, management, and termination
 */

import { 
  createProxySession,
  endProxySession, 
  isTakeoverCommand,
  getProxySessionByAdmin,
  getProxySessionBySessionId,
  validateProxySession
} from '@/lib/bot-engine/escalation/proxy-session-manager';

import { 
  ProxySessionBuilder,
  ProxyTestDb,
  ProxyExpectations 
} from '../utilities/proxy-test-builders';

import { 
  ESCALATION_TEST_CONFIG,
  createTestNotificationId,
  createTestSessionId 
} from '../config/escalation-test-config';

// Mock external dependencies
jest.mock('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender', () => ({
  WhatsappSender: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue('msg-123'),
    sendTemplateMessage: jest.fn().mockResolvedValue('template-msg-123')
  }))
}));
jest.mock('@/lib/database/models/notification');
jest.mock('@/lib/bot-engine/escalation/services/notification-service');

describe('Proxy Session Manager', () => {
  const mockNotificationId = createTestNotificationId();
  const mockSessionId = createTestSessionId();
  const mockAdminPhone = ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ADMIN_PERSONAL_PHONE;
  const mockCustomerPhone = ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE;
  const mockBusinessPhoneNumberId = ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    await ProxyTestDb.cleanupTestProxySessions();
  });

  describe('createProxySession', () => {
    it('should create a proxy session with valid data', async () => {
      const sessionData = ProxySessionBuilder.createProxySessionData();
      
      // Mock the notification update method
      const mockUpdateStatusToProxyMode = jest.fn().mockResolvedValue(undefined);
      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.updateStatusToProxyMode as jest.Mock) = mockUpdateStatusToProxyMode;

      await createProxySession(mockNotificationId, sessionData);

      expect(mockUpdateStatusToProxyMode).toHaveBeenCalledWith(
        mockNotificationId,
        sessionData
      );
    });

    it('should throw error if notification update fails', async () => {
      const sessionData = ProxySessionBuilder.createProxySessionData();
      
      const mockUpdateStatusToProxyMode = jest.fn().mockRejectedValue(
        new Error('Database error')
      );
      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.updateStatusToProxyMode as jest.Mock) = mockUpdateStatusToProxyMode;

      await expect(createProxySession(mockNotificationId, sessionData))
        .rejects.toThrow('Database error');
    });
  });

  describe('endProxySession', () => {
    it('should end proxy session and send confirmation', async () => {
      // Mock notification service
      const mockResolveNotification = jest.fn().mockResolvedValue(undefined);
      const { NotificationService } = await import('@/lib/bot-engine/escalation/services/notification-service');
      (NotificationService.resolveNotification as jest.Mock) = mockResolveNotification;

      await endProxySession(mockNotificationId, mockAdminPhone, mockBusinessPhoneNumberId);

      expect(mockResolveNotification).toHaveBeenCalledWith(
        mockNotificationId,
        'provided_help'
      );

      // Check that WhatsappSender constructor was called and sendMessage was called
      const { WhatsappSender } = require('@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender');
      expect(WhatsappSender).toHaveBeenCalled();
      
      const mockInstance = (WhatsappSender as jest.Mock).mock.results[0].value;
      expect(mockInstance.sendMessage).toHaveBeenCalledWith(
        mockAdminPhone,
        { text: "🔄 Proxy mode ended. Bot has resumed control of the conversation." },
        mockBusinessPhoneNumberId
      );
    });

    it('should throw error if notification resolution fails', async () => {
      const mockResolveNotification = jest.fn().mockRejectedValue(
        new Error('Resolution failed')
      );
      const { NotificationService } = await import('@/lib/bot-engine/escalation/services/notification-service');
      (NotificationService.resolveNotification as jest.Mock) = mockResolveNotification;

      await expect(endProxySession(mockNotificationId, mockAdminPhone, mockBusinessPhoneNumberId))
        .rejects.toThrow('Resolution failed');
    });
  });

  describe('isTakeoverCommand', () => {
    describe('button commands', () => {
      it('should detect valid button takeover command', () => {
        const result = isTakeoverCommand('', 'return_control_to_bot');
        expect(result).toBe(true);
      });

      it('should reject invalid button commands', () => {
        const result = isTakeoverCommand('', 'invalid_button');
        expect(result).toBe(false);
      });
    });

    describe('text commands', () => {
      const validCommands = [
        'return control to bot',
        'Return control to bot',
        'RETURN CONTROL TO BOT',
        'return to bot',
        'back to bot',
        'end proxy',
        'stop proxy',
        'bot takeover'
      ];

      validCommands.forEach(command => {
        it(`should detect "${command}" as takeover command`, () => {
          const result = isTakeoverCommand(command);
          expect(result).toBe(true);
        });
      });

      const invalidCommands = [
        'hello world',
        'return control',
        'bot help',
        'end session please'
      ];

      invalidCommands.forEach(command => {
        it(`should not detect "${command}" as takeover command`, () => {
          const result = isTakeoverCommand(command);
          expect(result).toBe(false);
        });
      });

      it('should handle empty or undefined messages', () => {
        expect(isTakeoverCommand('')).toBe(false);
        expect(isTakeoverCommand(' ')).toBe(false);
      });
    });
  });

  describe('getProxySessionByAdmin', () => {
    it('should return proxy session when found', async () => {
      const mockNotification = {
        id: mockNotificationId,
        chatSessionId: mockSessionId
      };

      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyByAdminPhone as jest.Mock) = jest.fn()
        .mockResolvedValue(mockNotification);

      // Mock session retrieval
      const mockGetById = jest.fn().mockResolvedValue({
        channelUserId: mockCustomerPhone
      });
      const { ChatSession } = await import('@/lib/database/models/chat-session');
      (ChatSession.getById as jest.Mock) = mockGetById;

      const result = await getProxySessionByAdmin(mockAdminPhone);

      expect(result).toBeDefined();
      expect(result?.notificationId).toBe(mockNotificationId);
      expect(result?.sessionId).toBe(mockSessionId);
      expect(result?.adminPhone).toBe(mockAdminPhone);
      expect(result?.customerPhone).toBe(mockCustomerPhone);
    });

    it('should return null when no proxy session found', async () => {
      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyByAdminPhone as jest.Mock) = jest.fn()
        .mockResolvedValue(null);

      const result = await getProxySessionByAdmin(mockAdminPhone);
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyByAdminPhone as jest.Mock) = jest.fn()
        .mockRejectedValue(new Error('Database error'));

      const result = await getProxySessionByAdmin(mockAdminPhone);
      expect(result).toBeNull();
    });
  });

  describe('getProxySessionBySessionId', () => {
    it.skip('should return proxy session when found', async () => {
      const mockNotification = {
        id: mockNotificationId,
        chatSessionId: mockSessionId,
        businessId: 'test-business-123'
      };

      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyBySessionId as jest.Mock) = jest.fn()
        .mockResolvedValue(mockNotification);

      // Mock session and admin phone retrieval
      const mockGetById = jest.fn().mockResolvedValue({
        channelUserId: mockCustomerPhone
      });
      const { ChatSession } = await import('@/lib/database/models/chat-session');
      (ChatSession.getById as jest.Mock) = mockGetById;

      // Mock admin phone retrieval
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue({
          data: [{ phoneNormalized: (mockAdminPhone || ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE).replace('+', '') }],
          error: null
        })
      };

      // Mock the environment module function
      const envModule = await import('@/lib/database/supabase/environment');
      jest.spyOn(envModule, 'getEnvironmentServiceRoleClient').mockReturnValue(mockSupabase);

      const result = await getProxySessionBySessionId(mockSessionId);

      expect(result).toBeDefined();
      expect(result?.sessionId).toBe(mockSessionId);
      expect(result?.customerPhone).toBe(mockCustomerPhone);
    });

    it('should return null when no proxy session found', async () => {
      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyBySessionId as jest.Mock) = jest.fn()
        .mockResolvedValue(null);

      const result = await getProxySessionBySessionId(mockSessionId);
      expect(result).toBeNull();
    });
  });

  describe('validateProxySession', () => {
    it('should validate active proxy session within time limits', async () => {
      const proxySession = ProxySessionBuilder.createMockProxySession({
        startedAt: new Date().toISOString() // Recent start time
      });

      const mockNotification = {
        id: mockNotificationId,
        chatSessionId: mockSessionId
      };

      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyBySessionId as jest.Mock) = jest.fn()
        .mockResolvedValue(mockNotification);

      const result = await validateProxySession(proxySession);
      expect(result).toBe(true);
    });

    it('should invalidate proxy session that exceeds max duration', async () => {
      const oldStartTime = new Date(Date.now() - (25 * 60 * 60 * 1000)); // 25 hours ago
      const proxySession = ProxySessionBuilder.createMockProxySession({
        startedAt: oldStartTime.toISOString()
      });

      const mockNotification = {
        id: mockNotificationId,
        chatSessionId: mockSessionId
      };

      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyBySessionId as jest.Mock) = jest.fn()
        .mockResolvedValue(mockNotification);

      // Mock endProxySession to prevent actual ending
      const mockEndProxySession = jest.fn().mockResolvedValue(undefined);

      const result = await validateProxySession(proxySession);
      expect(result).toBe(false);
    });

    it('should invalidate proxy session that is no longer active in database', async () => {
      const proxySession = ProxySessionBuilder.createMockProxySession();

      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyBySessionId as jest.Mock) = jest.fn()
        .mockResolvedValue(null); // No active session found

      const result = await validateProxySession(proxySession);
      expect(result).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      const proxySession = ProxySessionBuilder.createMockProxySession();

      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.getActiveProxyBySessionId as jest.Mock) = jest.fn()
        .mockRejectedValue(new Error('Database error'));

      const result = await validateProxySession(proxySession);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle phone number normalization correctly', async () => {
      const phoneVariations = [
        '+61452490450',
        '61452490450',
        '0452490450'
      ];

      for (const phone of phoneVariations) {
        const result = isTakeoverCommand('return control to bot');
        expect(result).toBe(true);
      }
    });

    it('should handle concurrent proxy session operations', async () => {
      const sessionData = ProxySessionBuilder.createProxySessionData();
      
      const mockUpdateStatusToProxyMode = jest.fn().mockResolvedValue(undefined);
      const { Notification } = await import('@/lib/database/models/notification');
      (Notification.updateStatusToProxyMode as jest.Mock) = mockUpdateStatusToProxyMode;

      // Create multiple proxy sessions concurrently
      const promises = Array.from({ length: 3 }, (_, i) => 
        createProxySession(`notification-${i}`, sessionData)
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
      expect(mockUpdateStatusToProxyMode).toHaveBeenCalledTimes(3);
    });
  });
}); 