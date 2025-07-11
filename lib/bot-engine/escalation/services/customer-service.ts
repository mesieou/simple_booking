import { User } from '@/lib/database/models/user';
import { ChatSession } from '@/lib/database/models/chat-session';
import { type CustomerContext, EscalationError, EscalationErrorCode } from '../types';

const LOG_PREFIX = '[CustomerService]';

export class CustomerService {
  /**
   * Unified customer name resolution with fallback chain:
   * 1. WhatsApp profile name
   * 2. Passed customer user (firstName + lastName)
   * 3. Linked user from session
   * 4. Phone number fallback
   */
  static async resolveCustomerName(context: {
    whatsappName?: string;
    customerUser?: { firstName?: string; lastName?: string; id?: string };
    sessionId?: string;
    phoneNumber?: string;
  }): Promise<string> {
    const { whatsappName, customerUser, sessionId, phoneNumber } = context;
    
    try {
      // 1. WhatsApp profile name (highest priority)
      if (whatsappName?.trim()) {
        console.log(`${LOG_PREFIX} Using WhatsApp profile name: ${whatsappName}`);
        return whatsappName.trim();
      }
      
      // 2. Passed customer user
      if (customerUser?.firstName && customerUser?.lastName) {
        const fullName = `${customerUser.firstName} ${customerUser.lastName}`;
        console.log(`${LOG_PREFIX} Using passed customer user name: ${fullName}`);
        return fullName;
      }
      
      // 3. Try to get linked user from session
      if (sessionId) {
        const linkedUserName = await this.getLinkedUserName(sessionId);
        if (linkedUserName) {
          console.log(`${LOG_PREFIX} Using linked user name from DB: ${linkedUserName}`);
          return linkedUserName;
        }
      }
      
      // 4. Phone number fallback
      if (phoneNumber) {
        console.log(`${LOG_PREFIX} Using phone number fallback: ${phoneNumber}`);
        return phoneNumber;
      }
      
      // 5. Default fallback
      console.log(`${LOG_PREFIX} Using default fallback name`);
      return 'Unknown Customer';
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error resolving customer name:`, error);
      throw new EscalationError(
        'Failed to resolve customer name',
        EscalationErrorCode.CUSTOMER_NAME_RESOLUTION_FAILED,
        { context, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
  
  /**
   * Gets linked user name from session
   */
  private static async getLinkedUserName(sessionId: string): Promise<string | null> {
    try {
      const chatSession = await ChatSession.getById(sessionId);
      
      if (!chatSession?.userId) {
        return null;
      }
      
      const linkedUser = await User.getById(chatSession.userId);
      
      if (linkedUser?.firstName && linkedUser?.lastName) {
        return `${linkedUser.firstName} ${linkedUser.lastName}`;
      }
      
      return null;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error getting linked user name:`, error);
      return null;
    }
  }
  
  /**
   * Creates a customer context from various sources
   */
  static createCustomerContext(data: {
    whatsappName?: string;
    customerUser?: { firstName?: string; lastName?: string; id?: string };
    phoneNumber?: string;
  }): CustomerContext {
    return {
      id: data.customerUser?.id,
      firstName: data.customerUser?.firstName,
      lastName: data.customerUser?.lastName,
      whatsappName: data.whatsappName,
      phoneNumber: data.phoneNumber
    };
  }
  
  /**
   * Validates customer phone number format
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (adjust regex as needed)
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phoneNumber);
  }
  
  /**
   * Formats customer display name for templates
   */
  static formatDisplayName(name: string, maxLength: number = 50): string {
    if (name.length <= maxLength) {
      return name;
    }
    
    return name.substring(0, maxLength - 3) + '...';
  }
} 