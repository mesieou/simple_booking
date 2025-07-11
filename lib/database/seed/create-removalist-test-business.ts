import { Business, type BusinessData } from '../models/business';
import { User, type UserRole } from '../models/user';
import { Service, type ServiceData, type PricingType } from '../models/service';
import { CalendarSettings, type CalendarSettingsData, type ProviderWorkingHours } from '../models/calendar-settings';
import { Document, type DocumentData } from '../models/documents';
import { computeInitialAvailability } from '../../general-helpers/availability';
import { v4 as uuidv4 } from 'uuid';
import { getServiceRoleClient } from '../supabase/service-role';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clearBusinessDataById } from './clear-database';

export interface RemovalistTestBusinessSeedResult {
  businessId: string;
  ownerProviderId: string;
  serviceIds: string[];
  calendarSettingsId: string;
  documentIds: string[];
}

/**
 * Creates a complete TEST business for Quick Move Removalists with:
 * - Business profile with removalist category
 * - 8 removalist services (single item, few items, house moves)
 * - Calendar settings and availability
 * - Knowledge base documents
 * - PDF content processing capability
 * - Embeddings generation for RAG functionality
 * 
 * ⚠️  DEVELOPMENT ONLY: This is a fake business for testing purposes
 */
export async function createRemovalistTestBusiness(supabase?: SupabaseClient): Promise<RemovalistTestBusinessSeedResult> {
  // SAFETY CHECK: Prevent this from running against production
  // Check both public URL and dev URL to determine environment
  const currentSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const devSupabaseUrl = process.env.SUPABASE_DEV_URL;
  const isProductionUrl = currentSupabaseUrl && currentSupabaseUrl.includes('itjtaeggupasvrepfkcw');
  const hasDevCredentials = !!(devSupabaseUrl && process.env.SUPABASE_DEV_SERVICE_ROLE_KEY);
  
  // Allow if we have dev credentials or a custom client is provided
  if (isProductionUrl && !supabase && !hasDevCredentials) {
    throw new Error('🚨 BLOCKED: Cannot create test removalist business in PRODUCTION environment! This is a fake business for development only.');
  }
  
  console.log('[SEED] Starting database seeding for Quick Move Removalists (DEVELOPMENT ONLY)...');
  console.log('[SEED] Environment:', {
    supabaseUrl: supabase ? 'Using provided client' : (devSupabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasDevCredentials: hasDevCredentials,
    usingProvidedClient: !!supabase,
    isProductionUrl: isProductionUrl,
    usingDevEnvironment: hasDevCredentials
  });
  
  // Use development Supabase client if available, otherwise fall back to default
  const supa = supabase || getServiceRoleClient();

  // --- TARGETED CLEANUP OF EXISTING REMOVALIST DATA ---
  // Clean up only the specific removalist business by name and email (not phone numbers)
  console.log('[SEED] Checking for existing Quick Move Removalists business data to clean up...');
  const { data: businesses, error: businessError } = await supa
    .from('businesses')
    .select('id, name, email')
    .or('name.eq.Quick Move Removalists,email.eq.mike.thompson@quickmove.com.au');

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
    console.log('[SEED] No existing Quick Move Removalists business data found to clean up.');
  }

  let createdBusinessId: string | null = null;

  try {
    // --- CREATE NEW BUSINESS ---
    console.log('[SEED] Creating new removalist business...');
    const businessData: BusinessData = {
      name: 'Quick Move Removalists',
      email: 'mike.thompson@quickmove.com.au', 
      phone: '+61473164581',
      timeZone: 'Australia/Sydney',
      interfaceType: 'whatsapp',
      whatsappNumber: '+61411851098',
      whatsappPhoneNumberId: '684078768113901', // WhatsApp Business API phone number ID
      businessAddress: '45 Industrial Drive, Sunshine West, VIC 3020',
      websiteUrl: 'https://quickmoveremovals.com.au',
      businessCategory: 'removalist', // Set business category for removalist
      depositPercentage: 25, // 25% deposit required for bookings
      stripeConnectAccountId: 'acct_1RdjJT00GaxmqnjE', // Stripe Connect account ID
      stripeAccountStatus: 'active',
      preferredPaymentMethod: 'cash'
    };

    const businessInstance = new Business(businessData);
    const createdBusiness = await businessInstance.addWithClient(supa);
    
    if (!createdBusiness.id) {
      throw new Error('[SEED] Failed to create test business for Quick Move Removalists - No ID returned');
    }
    
    createdBusinessId = createdBusiness.id; // Track for cleanup on failure
    console.log(`[SEED] Business '${createdBusiness.name}' created with ID: ${createdBusiness.id}`);

    // --- CREATE OWNER PROVIDER ---
    console.log('[SEED] Creating owner provider...');
    const ownerProvider = new User(
      'Mike', 
      'Thompson', 
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
      supabaseClient: supa // Use the same client as business creation
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

    // --- CREATE REMOVALIST SERVICES ---
    console.log('[SEED] Creating removalist services...');
    const serviceIds: string[] = [];
    const servicesData: Omit<ServiceData, 'businessId' | 'id'>[] = [
      // Single Item Move Services
      {
        name: 'Single item move - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.50, // Now using decimal values with float8 column
        baseCharge: 80.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 40, 
        mobile: true, // Removalist services are mobile
      },
      {
        name: 'Single item move - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 3.50,
        baseCharge: 120.00,
        description: 'Two removalists and a truck.',
        durationEstimate: 40, 
        mobile: true,
      },
      // Few Items Move Services
      {
        name: 'Few items move - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.50,
        baseCharge: 80.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 60, 
        mobile: true,
      },
      {
        name: 'Few items move - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 3.50,
        baseCharge: 120.00,
        description: 'Two removalists and a truck. Assistance is required',
        durationEstimate: 60, 
        mobile: true,
      },
      // House Move 1 Bedroom Services
      {
        name: 'House Move 1 bedroom - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.50,
        baseCharge: 80.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 120, 
        mobile: true,
      },
      {
        name: 'House Move 1 bedroom - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 3.50,
        baseCharge: 120.00,
        description: 'Two removalists and a truck.',
        durationEstimate: 120, 
        mobile: true,
      },
      // House Move 2+ Bedroom Services
      {
        name: 'House Move 2+ bedroom - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.50,
        baseCharge: 80.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 180, 
        mobile: true,
      },
      {
        name: 'House Move 2+ bedroom - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 3.50,
        baseCharge: 120.00,
        description: 'Two removalists and a truck.',
        durationEstimate: 180, 
        mobile: true,
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
    const mikeWorkingHours: ProviderWorkingHours = {
      mon: { start: '06:00', end: '18:00' },
      tue: { start: '06:00', end: '18:00' },
      wed: { start: '06:00', end: '18:00' },
      thu: { start: '06:00', end: '18:00' },
      fri: { start: '06:00', end: '18:00' },
      sat: { start: '06:00', end: '16:00' },
      sun: { start: '08:00', end: '14:00' }, // Limited Sunday hours
    };

    const calendarSettingsData: CalendarSettingsData = {
      userId: createdUser.id,
      businessId: createdBusiness.id,
      workingHours: mikeWorkingHours,
      calendarType: 'google', 
      settings: {
        bufferTime: 15, // 15 minutes buffer between moves
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

    console.log('[SEED] Database seeding completed successfully for Quick Move Removalists!');

    // --- TRIGGER PDF CONTENT CRAWLER FOR EMBEDDINGS (OPTIONAL) ---
    console.log('[SEED] Triggering PDF content crawler for document embeddings...');
    try {
      const crawlerResult = await triggerPdfContentCrawler(createdBusiness.id);
      console.log('[SEED] PDF content crawler completed:', crawlerResult.message || 'Success');
      
      // Check if embeddings were created
      const { data: embeddings, error: embeddingsError } = await supa
        .from('embeddings')
        .select('id')
        .eq('businessId', createdBusiness.id);
        
      if (!embeddingsError && embeddings) {
        console.log(`[SEED] Created ${embeddings.length} embeddings for RAG functionality`);
      }
    } catch (error) {
      console.warn('[SEED] PDF content crawler failed (non-critical):', error instanceof Error ? error.message : String(error));
      console.log('[SEED] Documents were still created successfully for manual processing');
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
 * Triggers the PDF content crawler to process removalist-specific documents
 * This is a non-critical operation - seeding will continue even if it fails
 */
async function triggerPdfContentCrawler(businessId: string): Promise<any> {
  try {
    console.log('[SEED] Loading removalist FAQ document for processing...');
    
    // Load the removalist-specific FAQ PDF file
    const fs = require('fs');
    const path = require('path');
    const pdfPath = path.join(process.cwd(), 'public', 'Removalist-FAQ-Handbook.pdf');
    
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
    const pdfFile = new File([pdfBlob], 'Removalist-FAQ-Handbook.pdf', { 
      type: 'application/pdf' 
    });
    
    formData.append('file', pdfFile);
    formData.append('businessId', businessId);
    
         // This is a development-only business, never target production
     formData.append('targetProduction', 'false'); // Explicitly development only
     
     // Determine the API endpoint URL (prefer localhost for development)
     const baseUrl = process.env.NODE_ENV === 'production' ? 'http://localhost:3000' : (process.env.WEBHOOK_BASE_URL || 'http://localhost:3000');
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
 * NOTE: This removalist business is for DEVELOPMENT/TESTING ONLY
 * It should NOT be created in production as it's a fake test business
 * 
 * Use createRemovalistTestBusiness() for development/staging environments only
 */ 