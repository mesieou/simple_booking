/**
 * Escalation Testing Configuration
 * 
 * This file provides database validation for escalation testing.
 * Instead of hardcoding values, it validates what's actually in the database.
 */

import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { getEscalationTemplateName } from '@/lib/bot-engine/escalation/types';

export interface ValidatedTestData {
  business: {
    id: string;
    name: string;
    phone: string;
    whatsappNumber: string;
    whatsappPhoneNumberId: string;
    email: string;
  };
  adminUser: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    whatsappNumber: string;
    email: string;
  };
  customerUser: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    whatsappNumber: string;
    email: string;
  };
}

// Known existing IDs in the database
const EXISTING_IDS = {
  BUSINESS_ID: 'ef97961f-18ad-4304-9d9d-6cd38308d65f',
  ADMIN_USER_ID: '5b6b6a4e-8ca0-4fa3-9549-bc576932c079', // Owner provider from seed
  CUSTOMER_USER_ID: 'f49476a7-cd9b-43cc-9239-0b7ed0689ac5' // Keep existing test customer
};

/**
 * Validates existing records and ensures they have required WhatsApp configuration
 * Uses the provided IDs of existing database records
 */
export async function getValidatedTestData(): Promise<ValidatedTestData> {
  const supabase = getEnvironmentServiceRoleClient();
  
  try {
    // 1. Validate the business exists and has WhatsApp config
    console.log('🔍 Validating business record...');
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', EXISTING_IDS.BUSINESS_ID)
      .single();

    if (businessError || !business) {
      throw new Error(`❌ Business ${EXISTING_IDS.BUSINESS_ID} not found in database.`);
    }

    // Fix missing WhatsApp configuration if needed
    if (business.interfaceType === 'whatsapp' && !business.whatsappNumber) {
      console.log('🔧 Adding missing WhatsApp number to business...');
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ 
          whatsappNumber: business.phone, // Use business phone as WhatsApp number
          updatedAt: new Date().toISOString() 
        })
        .eq('id', EXISTING_IDS.BUSINESS_ID);

      if (updateError) {
        throw new Error(`❌ Failed to update business WhatsApp config: ${updateError.message}`);
      }
      business.whatsappNumber = business.phone;
    }



    console.log('✅ Business validated:', business.name);

    // 2. Validate the admin user exists
    console.log('🔍 Validating admin user...');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('id', EXISTING_IDS.ADMIN_USER_ID)
      .single();

    if (adminError || !adminUser) {
      throw new Error(`❌ Admin user ${EXISTING_IDS.ADMIN_USER_ID} not found in database.`);
    }

    console.log('✅ Admin user validated:', `${adminUser.firstName} ${adminUser.lastName}`);

    // 3. Validate the customer user exists  
    console.log('🔍 Validating customer user...');
    const { data: customerUser, error: customerError } = await supabase
      .from('users')
      .select('*')
      .eq('id', EXISTING_IDS.CUSTOMER_USER_ID)
      .single();

    if (customerError || !customerUser) {
      throw new Error(`❌ Customer user ${EXISTING_IDS.CUSTOMER_USER_ID} not found in database.`);
    }

    console.log('✅ Customer user validated:', `${customerUser.firstName} ${customerUser.lastName}`);

    // 4. Return validated existing records
    return {
      business: {
        id: business.id,
        name: business.name,
        phone: business.phone,
        whatsappNumber: business.whatsappNumber || business.phone,
        whatsappPhoneNumberId: business.whatsappPhoneNumberId || 'test-phone-number-id-123',
        email: business.email
      },
      adminUser: {
        id: adminUser.id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        phone: adminUser.phoneNormalized ? `+${adminUser.phoneNormalized}` : business.phone,
        whatsappNumber: adminUser.whatsAppNumberNormalized ? `+${adminUser.whatsAppNumberNormalized}` : business.whatsappNumber || business.phone,
        email: adminUser.email
      },
      customerUser: {
        id: customerUser.id,
        firstName: customerUser.firstName,
        lastName: customerUser.lastName,
        phone: customerUser.phoneNormalized ? `+${customerUser.phoneNormalized}` : '+61473164581',
        whatsappNumber: customerUser.whatsAppNumberNormalized ? `+${customerUser.whatsAppNumberNormalized}` : '+61473164581',
        email: customerUser.email
      }
    };

  } catch (error) {
    console.error('❌ Database validation failed:', error);
    throw error;
  }
}

/**
 * Test configuration - Static parts available immediately, dynamic parts populated later
 * This maintains backward compatibility while using real database data
 */
export const ESCALATION_TEST_CONFIG = {
  // These will be populated by initializeEscalationTestConfig()
  LUISA_BUSINESS: {
    ID: EXISTING_IDS.BUSINESS_ID, // Available immediately
    NAME: '',
    PHONE: '',
    WHATSAPP_NUMBER: '',
    WHATSAPP_PHONE_NUMBER_ID: ''
  },
  ADMIN_USER: {
    ID: EXISTING_IDS.ADMIN_USER_ID, // Available immediately
    PHONE: '',
    WHATSAPP_NAME: ''
  },
  CUSTOMER_USER: {
    ID: EXISTING_IDS.CUSTOMER_USER_ID, // Available immediately
    PHONE: '',
    NORMALIZED_PHONE: '',
    WHATSAPP_NAME: ''
  },
  // Static configuration - available immediately
  ESCALATION_TRIGGERS: {
    MEDIA_MESSAGES: [
      '[IMAGE] User sent an image',
      '[VIDEO] User sent a video', 
      '[DOCUMENT] User sent a document'
    ],
    HUMAN_REQUEST_MESSAGES: [
      'I want to speak to a human',
      'Can I talk to someone?',
      'I need human help',
      'Connect me to an agent',
      'Can you transfer me to a human?',
      'Quiero hablar con una persona',
      'Necesito ayuda humana'
    ],
    FRUSTRATION_MESSAGES: [
      'This is not working',
      'I am so frustrated',
      'This is terrible service',
      'You are not helping me',
      'I hate this bot'
    ],
    NON_ESCALATION_MESSAGES: [
      'I need help with booking',
      'Can you help me?',
      'What services do you offer?',
      'How much does it cost?',
      '[STICKER] 😀' // Stickers should not escalate
    ]
  },
  EXPECTED_RESPONSES: {
    MEDIA_REDIRECT: {
      en: 'I understand you\'ve shared media content with me',
      es: 'Entiendo que has compartido contenido multimedia'
    },
    HUMAN_REQUEST: {
      en: 'Let me connect you with our team',
      es: 'Permíteme conectarte con nuestro equipo'
    },
    FRUSTRATION_DETECTED: {
      en: 'I can see you\'re having trouble',
      es: 'Veo que estás teniendo dificultades'
    }
  },
  TEMPLATE_CONFIG: {
    get NAME() { return getEscalationTemplateName(); },
    LANGUAGES: ['en_US', 'es'],
    MAX_HISTORY_LENGTH: 600,
    MAX_CURRENT_MESSAGE_LENGTH: 150,
    TAKEOVER_BUTTON_ID: 'return_control_to_bot'
  },
  THRESHOLDS: {
    CONSECUTIVE_FRUSTRATED_MESSAGES: 3,
    MAX_PROXY_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
    TEST_TIMEOUT_MS: 30000 // 30 seconds for async operations
  },
  TIMEOUT_SECONDS: 30 // For backward compatibility with tests
};

/**
 * Initializes the test configuration with actual database data
 * This populates the dynamic parts of ESCALATION_TEST_CONFIG
 */
export async function initializeEscalationTestConfig(): Promise<void> {
  const validatedData = await getValidatedTestData();
  
  // Update the dynamic parts of the config
  ESCALATION_TEST_CONFIG.LUISA_BUSINESS.NAME = validatedData.business.name;
  ESCALATION_TEST_CONFIG.LUISA_BUSINESS.PHONE = validatedData.business.phone;
  ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_NUMBER = validatedData.business.whatsappNumber;
  ESCALATION_TEST_CONFIG.LUISA_BUSINESS.WHATSAPP_PHONE_NUMBER_ID = validatedData.business.whatsappPhoneNumberId;

  ESCALATION_TEST_CONFIG.ADMIN_USER.PHONE = validatedData.adminUser.phone;
  ESCALATION_TEST_CONFIG.ADMIN_USER.WHATSAPP_NAME = `${validatedData.adminUser.firstName} ${validatedData.adminUser.lastName}`;

  ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE = validatedData.customerUser.phone;
  ESCALATION_TEST_CONFIG.CUSTOMER_USER.NORMALIZED_PHONE = validatedData.customerUser.phone.replace(/[^\d]/g, '');
  ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME = `${validatedData.customerUser.firstName} ${validatedData.customerUser.lastName}`;

  console.log('✅ Escalation test configuration initialized with database data');
}

/**
 * Helper to get normalized phone number for database queries
 */
export function getNormalizedPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Helper to create test session ID
 */
export function createTestSessionId(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to create test notification ID
 */
export function createTestNotificationId(): string {
  return `test-notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
} 