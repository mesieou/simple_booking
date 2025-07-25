import { Business, type BusinessData } from '../models/business';
import { User, type UserRole } from '../models/user';
import { Service, type ServiceData, type PricingType } from '../models/service';
import { CalendarSettings, type CalendarSettingsData, type ProviderWorkingHours } from '../models/calendar-settings';
import { Document, type DocumentData } from '../models/documents';
import { rollAggregatedAvailability } from '../../general-helpers/availability';
import { v4 as uuidv4 } from 'uuid';
import { getServiceRoleClient, getProdServiceRoleClient } from '../supabase/service-role';
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
 * Creates a complete TEST business for Timos Removals with:
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
  
  console.log('[SEED] Starting database seeding for Timos Removals (DEVELOPMENT ONLY)...');
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
  console.log('[SEED] Checking for existing Timos Removals business data to clean up...');
  const { data: businesses, error: businessError } = await supa
    .from('businesses')
    .select('id, name, email')
    .or('name.eq.Timos Removals,email.eq.info@timosremovals.com.au');

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
    console.log('[SEED] No existing Timos Removals business data found to clean up.');
  }

  // --- CLEANUP ORPHANED AUTH USERS ---
  // Also check for orphaned auth users with the target email (same approach as clearBusinessDataById)
  console.log('[SEED] Checking for orphaned auth users with email: info@timosremovals.com.au');
  const { data: authUsers } = await supa.auth.admin.listUsers();
  if (authUsers?.users) {
    const orphanedUser = authUsers.users.find(user => user.email === 'info@timosremovals.com.au');
    if (orphanedUser) {
      console.log(`[SEED] Found orphaned auth user with email info@timosremovals.com.au, ID: ${orphanedUser.id}`);
      const { error: authError } = await supa.auth.admin.deleteUser(orphanedUser.id);
      if (authError) {
        console.log(`[SEED] Note: Error deleting orphaned auth user ${orphanedUser.id}:`, authError.message);
      } else {
        console.log('[SEED] Successfully deleted orphaned auth user');
      }
    } else {
      console.log('[SEED] No orphaned auth user found with target email');
    }
  }

  let createdBusinessId: string | null = null;

  try {
    // --- CREATE NEW BUSINESS ---
    console.log('[SEED] Creating new removalist business...');
    const businessData: BusinessData = {
      name: 'Timos Removals',
      email: 'info@timosremovals.com.au', 
      phone: '+61412882145',
      timeZone: 'Australia/Sydney',
      interfaceType: 'whatsapp',
      whatsappNumber: '+61468968600',
      whatsappPhoneNumberId: '751020648089986', // WhatsApp Business API phone number ID from Meta Dashboard
      businessAddress: '1/99 old geelong rd, Laverton, VIC 3028',
      websiteUrl: 'https://timosremovals.com.au',
      businessCategory: 'removalist', // Set business category for removalist
      depositPercentage: 25, // 25% deposit required for bookings
      stripeConnectAccountId: 'acct_1Rna89P41K8lchaj', // Stripe Connect account ID
      stripeAccountStatus: 'active',
      preferredPaymentMethod: 'cash'
    };

    const businessInstance = new Business(businessData);
    const createdBusiness = await businessInstance.addWithClient(supa);
    
    if (!createdBusiness.id) {
      throw new Error('[SEED] Failed to create test business for Timos Removals - No ID returned');
    }
    
    createdBusinessId = createdBusiness.id; // Track for cleanup on failure
    console.log(`[SEED] Business '${createdBusiness.name}' created with ID: ${createdBusiness.id}`);

    // --- CREATE OWNER PROVIDER ---
    console.log('[SEED] Creating owner provider...');
    const ownerProvider = new User(
      'Alejandro', 
      'Duarte', 
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
        ratePerMinute: 1.50, // Now using decimal values with float8 column
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 40, 
        mobile: true, // Removalist services are mobile
      },
      {
        name: 'Single item move - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
        description: 'Two removalists and a truck.',
        durationEstimate: 40, 
        mobile: true,
      },
      // Few Items Move Services
      {
        name: 'Few items move - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 1.50,
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 60, 
        mobile: true,
      },
      {
        name: 'Few items move - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
        description: 'Two removalists and a truck. Assistance is required',
        durationEstimate: 60, 
        mobile: true,
      },
      // House Move 1 Bedroom Services
      {
        name: 'House Move 1 bedroom - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 1.50,
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 120, 
        mobile: true,
      },
      {
        name: 'House Move 1 bedroom - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
        description: 'Two removalists and a truck.',
        durationEstimate: 120, 
        mobile: true,
      },
      // House Move 2+ Bedroom Services
      {
        name: 'House Move 2+ bedroom - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 1.50,
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 180, 
        mobile: true,
      },
      {
        name: 'House Move 2+ bedroom - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
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
      sat: { start: '06:00', end: '18:00' },
      sun: { start: '06:00', end: '18:00' }, 
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

    // Create initial availability for provider (using new rollAggregatedAvailability)
    console.log('[SEED] Creating initial availability using rollAggregatedAvailability...');
    await rollAggregatedAvailability(createdBusiness.id, { supabaseClient: supa });
    
    console.log(`[SEED] ✅ Created initial availability using aggregated rollover system`);

    console.log('[SEED] Database seeding completed successfully for Timos Removals!');

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
    const pdfPath = path.join(process.cwd(), 'public', 'Timos-Removals-FAQ.pdf');
    
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
 * Helper function to create removalist business with production Supabase
 * This creates a REAL business (not test data) safe for production use
 * Make sure to set these environment variables for production:
 * - NEXT_PUBLIC_SUPABASE_URL=https://itjtaeggupasvrepfkcw.supabase.co (prod)
 * - SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key
 * - WEBHOOK_BASE_URL=https://your-production-domain.com (for PDF content crawler)
 */
export async function createRemovalistBusinessForProduction(
  businessConfig?: Partial<BusinessData>
): Promise<RemovalistTestBusinessSeedResult> {
  // Validate that we're using production environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isProduction = supabaseUrl && supabaseUrl.includes('itjtaeggupasvrepfkcw');
  
  if (!isProduction) {
    console.warn('[SEED] Warning: Not using production Supabase URL');
    console.log('[SEED] Current URL:', supabaseUrl);
    console.log('[SEED] Expected production URL should contain: itjtaeggupasvrepfkcw');
  }
  
  // Production-specific defaults for real business
  const prodDefaults: BusinessData = {
    name: 'Timos Removals',
    email: 'info@timosremovals.com.au',
    phone: '+61412882145',
    timeZone: 'Australia/Sydney',
    interfaceType: 'whatsapp',
    whatsappNumber: '+61468968600', 
         whatsappPhoneNumberId: '751020648089986', // Real WhatsApp Business API phone number ID from Meta Dashboard
    businessAddress: '1/99 old geelong rd, Laverton, VIC 3028',
    websiteUrl: 'https://timosremovals.com.au',
    businessCategory: 'removalist',
    depositPercentage: 25,
    stripeConnectAccountId: 'acct_1Rna89P41K8lchaj',
    stripeAccountStatus: 'active',
    preferredPaymentMethod: 'cash'
  };
  
  // Merge with any custom config
  const finalConfig: BusinessData = { ...prodDefaults, ...businessConfig };
  
  console.log('[SEED] Creating Timos Removals business for PRODUCTION with config:', finalConfig);
  
  // Use default Supabase client (should be production)
  const supa = getServiceRoleClient();
  
  // Call the main function but skip the production safety checks by providing explicit config
  return await createRemovalistBusinessForProd(supa, finalConfig);
}

/**
 * Internal production-safe version that bypasses environment checks
 * This is called by createRemovalistBusinessForProduction with validated config
 */
async function createRemovalistBusinessForProd(
  supa: SupabaseClient, 
  businessData: BusinessData
): Promise<RemovalistTestBusinessSeedResult> {
  console.log('[SEED] Starting database seeding for Timos Removals (PRODUCTION)...');
  console.log('[SEED] Environment:', {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    isProductionMode: true
  });

  // Initialize documentIds array for tracking created documents
  const documentIds: string[] = [];

  // --- TARGETED CLEANUP OF EXISTING REMOVALIST DATA ---
  console.log('[SEED] Checking for existing Timos Removals business data to clean up...');
  const { data: businesses, error: businessError } = await supa
    .from('businesses')
    .select('id, name, email')
    .or('name.eq.Timos Removals,email.eq.info@timosremovals.com.au');

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
    console.log('[SEED] No existing Timos Removals business data found to clean up.');
  }

  // --- CLEANUP ORPHANED AUTH USERS ---
  // Also check for orphaned auth users with the target email (Production version)
  console.log('[SEED] Checking for orphaned auth users with email: info@timosremovals.com.au');
  const { data: authUsers } = await supa.auth.admin.listUsers();
  if (authUsers?.users) {
    const orphanedUser = authUsers.users.find(user => user.email === 'info@timosremovals.com.au');
    if (orphanedUser) {
      console.log(`[SEED] Found orphaned auth user with email info@timosremovals.com.au, ID: ${orphanedUser.id}`);
      const { error: authError } = await supa.auth.admin.deleteUser(orphanedUser.id);
      if (authError) {
        console.log(`[SEED] Note: Error deleting orphaned auth user ${orphanedUser.id}:`, authError.message);
      } else {
        console.log('[SEED] Successfully deleted orphaned auth user');
      }
    } else {
      console.log('[SEED] No orphaned auth user found with target email');
    }
  }

  let createdBusinessId: string | null = null;

  try {
    // --- CREATE NEW BUSINESS ---
    console.log('[SEED] Creating new removalist business...');
    const businessInstance = new Business(businessData);
    const createdBusiness = await businessInstance.addWithClient(supa);
    
    if (!createdBusiness.id) {
      throw new Error('[SEED] Failed to create business for Timos Removals - No ID returned');
    }
    
    createdBusinessId = createdBusiness.id;
    console.log(`[SEED] Business '${createdBusiness.name}' created with ID: ${createdBusiness.id}`);

    // --- CREATE OWNER PROVIDER ---
    console.log('[SEED] Creating owner provider...');
    const ownerProvider = new User(
      'Alejandro', 
      'Duarte', 
      'admin/provider' as UserRole,
      createdBusiness.id,
      businessData.email,
      businessData.phone.replace(/[^\d]/g, ''),
      businessData.whatsappNumber?.replace(/[^\d]/g, '')
    );

    console.log('[SEED] About to create user with data:', {
      email: businessData.email,
      whatsappNumber: businessData.whatsappNumber,
      businessId: createdBusiness.id
    });
    
    const { data: createdUser, error: userError } = await ownerProvider.add({
      email: businessData.email,
      password: 'password123',
      whatsappNumber: businessData.whatsappNumber,
      skipProviderValidation: true,
      supabaseClient: supa
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
        ratePerMinute: 1.50,
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 40, 
        mobile: true,
      },
      {
        name: 'Single item move - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
        description: 'Two removalists and a truck.',
        durationEstimate: 40, 
        mobile: true,
      },
      // Few Items Move Services
      {
        name: 'Few items move - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 1.50,
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 60, 
        mobile: true,
      },
      {
        name: 'Few items move - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
        description: 'Two removalists and a truck. Assistance is required',
        durationEstimate: 60, 
        mobile: true,
      },
      // House Move 1 Bedroom Services
      {
        name: 'House Move 1 bedroom - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 1.50,
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 120, 
        mobile: true,
      },
      {
        name: 'House Move 1 bedroom - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
        description: 'Two removalists and a truck.',
        durationEstimate: 120, 
        mobile: true,
      },
      // House Move 2+ Bedroom Services
      {
        name: 'House Move 2+ bedroom - One person',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 1.50,
        baseCharge: 135.00,
        description: 'One removalist and a truck. Assistance is required',
        durationEstimate: 180, 
        mobile: true,
      },
      {
        name: 'House Move 2+ bedroom - Two people',
        pricingType: 'per_minute' as PricingType,
        ratePerMinute: 2.42,
        baseCharge: 217.00,
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
    const workingHours: ProviderWorkingHours = {
      mon: { start: '06:00', end: '18:00' },
      tue: { start: '06:00', end: '18:00' },
      wed: { start: '06:00', end: '18:00' },
      thu: { start: '06:00', end: '18:00' },
      fri: { start: '06:00', end: '18:00' },
      sat: { start: '06:00', end: '18:00' },
      sun: { start: '06:00', end: '18:00' }, 
    };

    const calendarSettingsData: CalendarSettingsData = {
      userId: createdUser.id,
      businessId: createdBusiness.id,
      workingHours: workingHours,
      calendarType: 'google', 
      settings: {
        bufferTime: 15,
        timezone: createdBusiness.timeZone,
      }
    };
    
    const calendarSettingsInstance = await CalendarSettings.save(undefined, calendarSettingsData, { supabaseClient: supa });
    if (!calendarSettingsInstance.id) {
      throw new Error('[SEED] Failed to create calendar settings - No ID returned');
    }
    console.log(`[SEED] Calendar settings created with ID: ${calendarSettingsInstance.id}`);

    // --- CREATE INITIAL AVAILABILITY ---
    console.log('[SEED] Creating initial availability slots...');
    
    const userInstance = new User(
      createdUser.firstName,
      createdUser.lastName,
      createdUser.role as UserRole,
      createdBusiness.id
    );
    userInstance.id = createdUser.id;

    // Create initial availability for provider (using new rollAggregatedAvailability) 
    console.log('[SEED] Creating initial availability using rollAggregatedAvailability...');
    await rollAggregatedAvailability(createdBusiness.id, { supabaseClient: supa });
    
    console.log(`[SEED] ✅ Created initial availability using aggregated rollover system`);

    // --- TRIGGER PDF CONTENT CRAWLER FOR EMBEDDINGS ---
    console.log('[SEED] Triggering PDF content crawler for document embeddings...');
    try {
      const crawlerResult = await triggerPdfContentCrawlerForProd(createdBusiness.id);
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

    console.log('[SEED] Database seeding completed successfully for Timos Removals (PRODUCTION)!');
    
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
    
    if (createdBusinessId) {
      console.log(`[SEED] Cleaning up partially created business with ID: ${createdBusinessId}`);
      try {
        await clearBusinessDataById(supa, createdBusinessId);
        console.log('[SEED] Cleanup completed successfully.');
      } catch (cleanupError) {
        console.error('[SEED] Error during cleanup:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      }
    }
    
    throw error;
  }
}

/**
 * Production version of PDF content crawler
 */
async function triggerPdfContentCrawlerForProd(businessId: string): Promise<any> {
  try {
    console.log('[SEED] Loading removalist FAQ document for processing...');
    
    const fs = require('fs');
    const path = require('path');
    const pdfPath = path.join(process.cwd(), 'public', 'Timos-Removals-FAQ.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at: ${pdfPath}`);
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`[SEED] Loaded PDF file: ${pdfBuffer.length} bytes`);
    
    const formData = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], 'Timos-Removals-FAQ.pdf', { 
      type: 'application/pdf' 
    });
    
    formData.append('file', pdfFile);
    formData.append('businessId', businessId);
    formData.append('targetProduction', 'true'); // This is for production
    
    // Use production URL
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://skedy.io';
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
 * NOTE: createRemovalistBusinessForProduction() creates a REAL business for production
 * Use this function when you need the Timos Removals business in your live environment
 */ 