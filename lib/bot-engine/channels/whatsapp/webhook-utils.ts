import crypto from 'crypto';
import { Business } from '@/lib/database/models/business';
import { type WebhookAPIBody } from './whatsapp-message-logger';
import { getCurrentEnvironment } from '@/lib/database/supabase/environment';

const LOG_PREFIX = "[Webhook Utils]";

// Rate limiting storage (in production, use Redis or database)
const rateLimitStorage = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 200; // WhatsApp Business Management API limit

/**
 * Phone Number ID utilities for multi-tenant webhook routing
 */
export class PhoneNumberIdUtils {
    /**
   * Normalizes phone_number_id for comparison
   */
  static normalize(phoneNumberId: string | undefined): string {
    if (!phoneNumberId) return '';
    return phoneNumberId.toString().trim();
  }

  /**
   * Checks if phone_number_id should be ignored in production (dev testing)
   */
  static isDevNumber(phoneNumberId: string): boolean {
    const devPhoneNumberIds = process.env.DEV_PHONE_NUMBER_IDS;
    if (!devPhoneNumberIds) return false;
    
    const devNumbersList = devPhoneNumberIds.split(',').map(id => this.normalize(id));
    const normalizedId = this.normalize(phoneNumberId);
    
    return devNumbersList.includes(normalizedId);
  }

  /**
   * Checks if customer phone number should be treated as dev/testing (for dev webhook routing)
   */
  static isDevCustomerNumber(customerPhoneNumber: string): boolean {
    const devPhoneNumbers = process.env.DEV_PHONE_NUMBER_IDS;
    if (!devPhoneNumbers) return false;
    
    const devNumbersList = devPhoneNumbers.split(',').map(num => num.trim());
    
    return devNumbersList.includes(customerPhoneNumber);
  }

  /**
   * Extracts phone_number_id from WhatsApp webhook payload
   */
  static extractFromPayload(payload: WebhookAPIBody): string | null {
    try {
      // Extract from payload.entry[0].changes[0].value.metadata.phone_number_id
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const metadata = change?.value?.metadata;
      const phoneNumberId = metadata?.phone_number_id;
      
      return phoneNumberId ? this.normalize(phoneNumberId) : null;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error extracting phone_number_id from payload:`, error);
      return null;
    }
  }
}

/**
 * Webhook security and rate limiting utilities
 */
export class WebhookSecurityUtils {
  /**
   * Verifies webhook signature from Meta/WhatsApp to ensure authenticity
   */
  static verifySignature(payload: string, signature: string): boolean {
    const webhookAppSecret = process.env.WHATSAPP_APP_SECRET;
    
    if (!webhookAppSecret) {
      console.warn(`${LOG_PREFIX} WHATSAPP_APP_SECRET not configured - skipping signature verification`);
      return true; // Allow in development, but warn
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookAppSecret)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature));
  }

  /**
   * Checks if requests from this IP are within rate limits (prevents spam/abuse)
   */
  static checkRateLimit(clientIp: string): boolean {
    const now = Date.now();
    const rateLimitKey = `rate_limit_${clientIp}`;
    const currentUsage = rateLimitStorage.get(rateLimitKey);

    if (!currentUsage || now > currentUsage.resetTime) {
      rateLimitStorage.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return true;
    }

    if (currentUsage.count >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`${LOG_PREFIX} Rate limit exceeded for IP ${clientIp}: ${currentUsage.count}/${RATE_LIMIT_MAX_REQUESTS}`);
      return false;
    }

    currentUsage.count++;
    return true;
  }
}

/**
 * Business routing result
 */
export interface BusinessRoutingResult {
  success: boolean;
  business?: Business;
  phoneNumberId?: string;
  routingType: 'dev' | 'business' | 'unknown' | 'missing';
  message: string;
}

/**
 * Main webhook routing logic
 */
export class WebhookRouter {
  /**
   * Routes webhook payload to appropriate business or dev handler
   */
  static async routeByPhoneNumberId(payload: WebhookAPIBody): Promise<BusinessRoutingResult> {
    const phoneNumberId = PhoneNumberIdUtils.extractFromPayload(payload);
    
    if (!phoneNumberId) {
      console.warn(`${LOG_PREFIX} No phone_number_id found in webhook payload`);
      return {
        success: false,
        routingType: 'missing',
        message: 'No phone_number_id found in webhook payload'
      };
    }
    
    console.log(`${LOG_PREFIX} Processing webhook for phone_number_id: ${phoneNumberId}`);
    
    // Check for dev/testing numbers - skip ONLY in production
    const currentEnvironment = getCurrentEnvironment();
    if (PhoneNumberIdUtils.isDevNumber(phoneNumberId)) {
      if (currentEnvironment === 'production') {
        console.log(`${LOG_PREFIX} Dev/testing number detected: ${phoneNumberId} - skipping in production`);
        return {
          success: true,
          phoneNumberId,
          routingType: 'dev',
          message: `Dev/testing number ${phoneNumberId} - ignored in production, handled by dev webhook`
        };
      } else {
        console.log(`${LOG_PREFIX} Dev/testing number detected: ${phoneNumberId} - processing in ${currentEnvironment} environment`);
        // Continue processing in development/local environments
      }
    }
    
    // Look up business by phone_number_id
    const business = await Business.findByPhoneNumberId(phoneNumberId);
    
    if (!business) {
      console.warn(`${LOG_PREFIX} Unknown phone_number_id: ${phoneNumberId} - no business found`);
      return {
        success: false,
        phoneNumberId,
        routingType: 'unknown',
        message: `No business found for phone_number_id: ${phoneNumberId}`
      };
    }
    
    console.log(`${LOG_PREFIX} Routing to business: ${business.name} (ID: ${business.id}) for phone_number_id: ${phoneNumberId}`);
    
    return {
      success: true,
      business,
      phoneNumberId,
      routingType: 'business',
      message: `Routed to business: ${business.name}`
    };
  }
} 