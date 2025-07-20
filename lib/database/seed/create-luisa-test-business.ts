import { Business, type BusinessData } from '../models/business';
import { User, type UserRole } from '../models/user';
import { Service, type ServiceData, type PricingType } from '../models/service';
import { CalendarSettings, type CalendarSettingsData, type ProviderWorkingHours } from '../models/calendar-settings';
import { Document, type DocumentData } from '../models/documents';
import { computeInitialAvailability } from '../../general-helpers/availability';
import { v4 as uuidv4 } from 'uuid';
import { getServiceRoleClient, getProdServiceRoleClient } from '../supabase/service-role';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clearBusinessDataById } from './clear-database';

export interface LuisaTestBusinessSeedResult {
  businessId: string;
  ownerProviderId: string;
  serviceIds: string[];
  calendarSettingsId: string;
  documentIds: string[];
}

/**
 * Creates a complete test business for Luisa (Beauty Asiul) with:
 * - Business profile with all schema fields
 * - 13 nail & hair services organized by category with accurate pricing
 * - Calendar settings and availability
 * - 4 comprehensive knowledge base documents
 * - PDF content processing from public/Customer-Service-Handbook.pdf
 * - Embeddings generation for RAG functionality
 */
export async function createLuisaTestBusiness(
  supabase?: SupabaseClient, 
  businessConfig?: Partial<BusinessData>
): Promise<LuisaTestBusinessSeedResult> {
  console.log('[SEED] Starting database seeding for Luisa\'s Business (Beauty Asiul)...');
  console.log('[SEED] Environment:', {
    supabaseUrl: supabase ? 'Using provided client' : process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    usingProvidedClient: !!supabase,
    productionUrl: process.env.SUPABASE_PROD_URL,
    hasProductionServiceRoleKey: !!process.env.SUPABASE_PROD_SERVICE_ROLE_KEY,
    hasCustomConfig: !!businessConfig
  });
  
  const supa = supabase || getServiceRoleClient();

  // Default business configuration (backward compatibility)
  const defaultBusinessData: BusinessData = {
    name: 'Beauty Asiul',
    email: 'luisa.bernal7826@gmail.com', 
    phone: '+61473164581',
    timeZone: 'Australia/Sydney',
    interfaceType: 'whatsapp',
    whatsappNumber: '+61411851098',
    whatsappPhoneNumberId: '684078768113901', // WhatsApp Business API phone number ID
    businessAddress: '9 Dryburgh st, West Melbourne, VIC 3003',
    websiteUrl: undefined,
    businessCategory: 'salon', // Set business category for beauty salon
    depositPercentage: 50, // 50% deposit required for bookings
    stripeConnectAccountId: 'acct_1RdjJT00GaxmqnjE', // Stripe Connect account ID
    stripeAccountStatus: 'active',
    preferredPaymentMethod: 'cash'
  };

  // Merge custom config with defaults
  const businessData: BusinessData = {
    ...defaultBusinessData,
    ...businessConfig
  };

  console.log('[SEED] Using business configuration:', {
    name: businessData.name,
    email: businessData.email,
    phone: businessData.phone,
    whatsappNumber: businessData.whatsappNumber,
    whatsappPhoneNumberId: businessData.whatsappPhoneNumberId
  });

  // --- TARGETED CLEANUP OF EXISTING LUISA DATA ---
  // Clean up only the specific beauty business by name and email (not phone numbers)
  console.log('[SEED] Checking for existing Luisa business data to clean up...');
  const { data: businesses, error: businessError } = await supa
    .from('businesses')
    .select('id, name, email')
    .or(`name.eq.${businessData.name},email.eq.${businessData.email}`);

  if (businessError) {
    console.error('[SEED] Error checking for existing business, skipping cleanup:', businessError);
  } else if (businesses && businesses.length > 0) {
    console.log(`[SEED] Found ${businesses.length} existing business(es) to clean up:`, businesses);
    
    // Clean up all matching businesses
    for (const business of businesses) {
      console.log(`[SEED] Cleaning up business: ${business.name} (${business.email}) - ID: ${business.id}`);
      await clearBusinessDataById(supa, business.id);
    }
  } else {
    console.log('[SEED] No existing Luisa business data found to clean up.');
  }

  let createdBusinessId: string | null = null;

  try {
    // --- CREATE NEW BUSINESS ---
    console.log('[SEED] Creating new business...');

    const businessInstance = new Business(businessData);
    const createdBusiness = await businessInstance.addWithClient(supa);
    
    if (!createdBusiness.id) {
      throw new Error('[SEED] Failed to create test business for Luisa - No ID returned');
    }
    
    createdBusinessId = createdBusiness.id; // Track for cleanup on failure
    console.log(`[SEED] Business '${createdBusiness.name}' created with ID: ${createdBusiness.id}`);

    // --- CREATE OWNER PROVIDER ---
    console.log('[SEED] Creating owner provider...');
    const ownerProvider = new User(
      'Luisa', 
      'Bernal', 
      'admin/provider' as UserRole,
      createdBusiness.id,
      businessData.email, // email
      businessData.phone.replace(/[^\d]/g, ''), // phoneNormalized (digits only)
      businessData.whatsappNumber?.replace(/[^\d]/g, '') // whatsAppNumberNormalized
    );

    console.log('[SEED] About to create user with data:', {
      email: businessData.email,
      whatsappNumber: businessData.whatsappNumber,
      businessId: createdBusiness.id
    });
    
    const { data: createdUser, error: userError } = await ownerProvider.add({
      email: businessData.email,
      password: 'password123',
      whatsappNumber: businessData.whatsappNumber, // This will be normalized in the add method
      skipProviderValidation: true, // Allow for seed scripts
      supabaseClient: supa // Use the same client as business creation (production)
    });
    
    if (userError) {
      console.error('[SEED] Detailed user creation error:', {
        error: userError,
        message: (userError as any) instanceof Error ? (userError as Error).message : String(userError),
        stack: (userError as any) instanceof Error ? (userError as Error).stack : undefined
      });
      throw new Error(`[SEED] Failed to create user: ${userError ? String(userError) : 'No user data returned'}`);
    }
    
    if (!createdUser?.id) {
      console.error('[SEED] No user data returned from user creation');
      throw new Error(`[SEED] Failed to create user: No user data returned`);
    }
    console.log(`[SEED] User '${createdUser.firstName} ${createdUser.lastName}' created with ID: ${createdUser.id}`);

    // --- CREATE SERVICES ---
    console.log('[SEED] Creating services...');
  const serviceIds: string[] = [];
  const servicesData: Omit<ServiceData, 'businessId' | 'id'>[] = [
    // NAIL SERVICES - Manicures (5 services)
    {
      name: 'Basic Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 30.00,
      description: 'Cleaning, exfoliation, and moisturizing.',
      durationEstimate: 35, 
      mobile: false,
    },
    {
      name: 'Express Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 35.00,
      description: 'Cleaning, exfoliation, moisturizing, nail polish.',
      durationEstimate: 40, 
      mobile: false,
    },
    {
      name: 'Gel Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 40.00,
      description: 'Cleaning, exfoliation, moisturizing, gel.',
      durationEstimate: 60, 
      mobile: false,
    },
    {
      name: 'Press on Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 80.00,
      description: 'Cleaning, exfoliation, moisturizing, press-on nail extension, gel, nail art.',
      durationEstimate: 90, 
      mobile: false,
    },
    {
      name: 'Nail Art',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 5.00,
      description: 'Nail art design (2 nails $5 / 5-10 nails $10).',
      durationEstimate: 20, 
      mobile: false,
    },
    // NAIL SERVICES - Pedicures (2 services)
    {
      name: 'Basic Pedicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 45.00,
      description: 'Cleaning, exfoliation, moisturizing, nail polish.',
      durationEstimate: 45, 
      mobile: false, 
    },
    {
      name: 'Gel Pedicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 50.00,
      description: 'Cleaning, exfoliation, moisturizing, gel.',
      durationEstimate: 60,
      mobile: false,
    },
    // HAIR SERVICES (6 services)
    {
      name: 'Ladies Haircut',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 50.00,
      description: 'Professional ladies haircut.',
      durationEstimate: 30, 
      mobile: false,
    },
    {
      name: 'Hair Styling',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 50.00,
      description: 'Complete styling with braids, brushing, or updos.',
      durationEstimate: 60, 
      mobile: false,
    },
    {
      name: 'Braids',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 30.00,
      description: '1-3 braids (30 min).',
      durationEstimate: 30, 
      mobile: false,
    },
    {
      name: 'Blow Dry',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 35.00,
      description: 'Professional blow dry service.',
      durationEstimate: 30, 
      mobile: false,
    },
    {
      name: 'Waves',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 30.00,
      description: 'Professional wave styling.',
      durationEstimate: 45, 
      mobile: false,
    },
    {
      name: 'Treatments',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 60.00,
      description: 'Hair treatment services.',
      durationEstimate: 60, 
      mobile: false,
    }
  ];

  for (const serviceItem of servicesData) {
    const completeServiceData: ServiceData = {
      ...serviceItem,
      businessId: createdBusiness.id,
      id: uuidv4()
    };
    
    const serviceInstance = new Service(completeServiceData);
    const createdService = await serviceInstance.add({ supabaseClient: supa });
    
    if (createdService.id) {
      serviceIds.push(createdService.id);
      console.log(`[SEED] Service '${createdService.name}' created with ID: ${createdService.id}`);
    }
  }

  // --- CREATE CALENDAR SETTINGS ---
  console.log('[SEED] Creating calendar settings...');
  const luisaWorkingHours: ProviderWorkingHours = {
    mon: { start: '07:00', end: '17:00' },
    tue: { start: '07:00', end: '17:00' },
    wed: { start: '07:00', end: '17:00' },
    thu: { start: '07:00', end: '17:00' },
    fri: { start: '07:00', end: '17:00' },
    sat: { start: '07:00', end: '13:00' },
    sun: null, 
  };

  const calendarSettingsData: CalendarSettingsData = {
    userId: createdUser.id,
    businessId: createdBusiness.id,
    workingHours: luisaWorkingHours,
    calendarType: 'google', 
    settings: {
      bufferTime: 0, 
      timezone: createdBusiness.timeZone,
    }
  };
  
  const calendarSettingsInstance = await CalendarSettings.save(undefined, calendarSettingsData, { supabaseClient: supa });
  if (!calendarSettingsInstance.id) {
    throw new Error('[SEED] Failed to create calendar settings - No ID returned');
  }
  console.log(`[SEED] Calendar settings created with ID: ${calendarSettingsInstance.id}`);

  // --- SKIP MANUAL DOCUMENT CREATION ---
  // Documents will be created from the actual PDF processing
  const documentIds: string[] = [];
  console.log('[SEED] Skipping manual document creation - will use PDF processing');

  // --- CREATE INITIAL AVAILABILITY ---
  console.log('[SEED] Creating initial availability slots...');
  
  // Create User instance for availability computation  
  const userInstance = new User(
    createdUser.firstName,
    createdUser.lastName,
    createdUser.role as UserRole,
    createdBusiness.id
  );
  userInstance.id = createdUser.id;

  // Create initial availability for provider (simple pattern)
  const fromDate = new Date();
  const initialAvailability = await computeInitialAvailability(userInstance, fromDate, 30, businessInstance, { supabaseClient: supa });
  await Promise.all(initialAvailability.map(slots => slots.add({ supabaseClient: supa })));
  
  console.log(`[SEED] Created initial availability for ${initialAvailability.length} days`);

  console.log('[SEED] Database seeding completed successfully!');

  // --- TRIGGER PDF CONTENT CRAWLER FOR EMBEDDINGS ---
  console.log('[SEED] Triggering PDF content crawler for document embeddings...');
  try {
    const crawlerResult = await triggerPdfContentCrawler(createdBusiness.id);
    console.log('[SEED] PDF content crawler completed:', crawlerResult.message || 'Success');
    
    // Verify that the crawler actually processed content
    if (!crawlerResult || !crawlerResult.result || crawlerResult.result.pageCount === 0) {
      throw new Error(`PDF crawler failed to process any content: ${JSON.stringify(crawlerResult)}`);
    }
    
    // Check if embeddings were created
    const { data: embeddings, error: embeddingsError } = await supa
      .from('embeddings')
      .select('id')
      .eq('businessId', createdBusiness.id);
      
    if (embeddingsError) {
      throw new Error(`Failed to query embeddings: ${embeddingsError.message}`);
    }
    
    if (!embeddings || embeddings.length === 0) {
      throw new Error('No embeddings were created from PDF processing');
    }
    
    console.log(`[SEED] ✅ Created ${embeddings.length} embeddings for RAG functionality`);
  } catch (error) {
    console.error('[SEED] ❌ PDF content crawler failed - this is CRITICAL for business functionality');
    console.error('[SEED] Error details:', error instanceof Error ? error.message : String(error));
    throw new Error(`Luisa business seed failed: PDF crawler error - ${error instanceof Error ? error.message : String(error)}`);
  }
  
    return {
      businessId: createdBusiness.id,
      ownerProviderId: createdUser.id,
      serviceIds,
      calendarSettingsId: calendarSettingsInstance.id,
      documentIds
    };
    
  } catch (error) {
    console.error('[SEED] Error during business creation, cleaning up partial data...');
    console.error('[SEED] Error details:', error instanceof Error ? error.message : String(error));
    
    // Clean up the business that was created if the process failed later
    if (createdBusinessId) {
      console.log(`[SEED] Cleaning up partially created business with ID: ${createdBusinessId}`);
      try {
        await clearBusinessDataById(supa, createdBusinessId);
        console.log('[SEED] Cleanup completed successfully.');
      } catch (cleanupError) {
        console.error('[SEED] Error during cleanup:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      }
    }
    
    // Re-throw the original error
    throw error;
  }
}

/**
 * Triggers the PDF content crawler to process the actual Luisa FAQ WhatsApp conversations document
 * This is a non-critical operation - seeding will continue even if it fails
 */
async function triggerPdfContentCrawler(businessId: string): Promise<any> {
  try {
    console.log('[SEED] Loading luisa-faq.pdf for processing...');
    
    // Load the actual PDF file from the root folder
    const fs = require('fs');
    const path = require('path');
    const pdfPath = path.join(process.cwd(), 'luisa-faq.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at: ${pdfPath}`);
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`[SEED] Loaded PDF file: ${pdfBuffer.length} bytes`);
    
    // Create Web API compatible FormData
    const formData = new FormData();
    
    // Create a Blob from the buffer
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    // Create a File object from the Blob
    const pdfFile = new File([pdfBlob], 'luisa-faq.pdf', { 
      type: 'application/pdf' 
    });
    
    formData.append('file', pdfFile);
    formData.append('businessId', businessId);
    
    // Check if we're in production mode and set the flag
    const isProductionMode = process.env.SUPABASE_PROD_URL && process.env.SUPABASE_PROD_URL.includes('itjtaeggupasvrepfkcw');
    if (isProductionMode) {
      formData.append('targetProduction', 'true');
    }
    
    // Determine the API endpoint URL 
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/content-crawler/pdf`;
    
    console.log(`[SEED] Calling PDF content crawler API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDF Crawler API returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[SEED] PDF content crawler API response:', result);
    
    return result;
  } catch (error) {
    console.error('[SEED] PDF content crawler error:', error);
    throw error;
  }
}

/**
 * Helper function to create Luisa's business with production Supabase
 * Make sure to set these environment variables for production:
 * - SUPABASE_PROD_URL=https://itjtaeggupasvrepfkcw.supabase.co (prod)
 * - SUPABASE_PROD_SERVICE_ROLE_KEY=your_prod_service_role_key
 * - WEBHOOK_BASE_URL=https://your-production-domain.com (for PDF content crawler)
 */
export async function createLuisaTestBusinessForProduction(
  businessConfig?: Partial<BusinessData>
): Promise<LuisaTestBusinessSeedResult> {
  // Validate that we're using production environment
  const supabaseUrl = process.env.SUPABASE_PROD_URL;
  const isProduction = supabaseUrl && supabaseUrl.includes('itjtaeggupasvrepfkcw');
  
  if (!isProduction) {
    console.warn('[SEED] Warning: Not using production Supabase URL');
    console.log('[SEED] Current URL:', supabaseUrl);
    console.log('[SEED] Expected production URL should contain: itjtaeggupasvrepfkcw');
  }
  
  // Production-specific defaults
  const prodDefaults: Partial<BusinessData> = {
    name: 'Beauty Asiul',
    email: 'luisa.bernal7826@gmail.com',
    phone: '+61411851098',
    whatsappNumber: '+61411851098', 
    whatsappPhoneNumberId: '484592048053952', // Different from dev
    preferredPaymentMethod: 'card'
  };
  
  // Merge with any custom config
  const finalConfig = { ...prodDefaults, ...businessConfig };
  
  console.log('[SEED] Creating Luisa business for PRODUCTION with config:', finalConfig);
  
  // Create production client and pass it explicitly
  const productionClient = getProdServiceRoleClient();
  return createLuisaTestBusiness(productionClient, finalConfig);
} 