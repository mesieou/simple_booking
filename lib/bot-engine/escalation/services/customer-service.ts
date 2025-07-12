import { User } from '@/lib/database/models/user';
import { ChatSession } from '@/lib/database/models/chat-session';
import { type CustomerContext, EscalationError, EscalationErrorCode } from '../types';

const LOG_PREFIX = '[CustomerService]';

export class CustomerService {
  /**
   * Resolves customer name from customer user data
   * Customers should already have proper names in the system
   */
  static async resolveCustomerName(context: {
    whatsappName?: string;
    customerUser?: { firstName?: string; lastName?: string; id?: string };
    sessionId?: string;
    phoneNumber?: string;
  }): Promise<string> {
    const { customerUser, phoneNumber } = context;
    
    try {
      // Use customer user data - this should always exist
      if (customerUser?.firstName && customerUser?.lastName) {
        const fullName = `${customerUser.firstName} ${customerUser.lastName}`;
        console.log(`${LOG_PREFIX} Using customer name: ${fullName}`);
        return fullName;
      }
      
      if (customerUser?.firstName) {
        console.log(`${LOG_PREFIX} Using customer first name: ${customerUser.firstName}`);
        return customerUser.firstName;
      }
      
      // If we get here, there's a problem with the customer data
      console.error(`${LOG_PREFIX} No customer name available - customer data missing!`, { 
        hasCustomerUser: !!customerUser,
        customerId: customerUser?.id,
        phoneNumber 
      });
      
      return phoneNumber || 'Unknown Customer';
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error resolving customer name:`, error);
      return phoneNumber || 'Unknown Customer';
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