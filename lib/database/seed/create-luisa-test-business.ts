import { Business, type BusinessData } from '../models/business';
import { User, type UserRole } from '../models/user';
import { Service, type ServiceData, type PricingType } from '../models/service';
import { CalendarSettings, type CalendarSettingsData, type ProviderWorkingHours } from '../models/calendar-settings';
import { computeInitialAvailability } from '../../general-helpers/availability';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '../supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clearBusinessDataById } from './clear-database';

export interface LuisaTestBusinessSeedResult {
  businessId: string;
  ownerProviderId: string;
  serviceIds: string[];
  calendarSettingsId: string;
}

export async function createLuisaTestBusiness(supabase?: SupabaseClient): Promise<LuisaTestBusinessSeedResult> {
  console.log('[SEED] Starting database seeding for Luisa\'s Business (Beauty Asiul)...');
  
  const supa = supabase || await createClient();

  // --- METHODICAL CLEANUP OF EXISTING BUSINESS ---
  // Find and clean up the specific test business if it exists
  console.log('[SEED] Checking for existing Luisa business to clean up...');
  const { data: businesses, error: businessError } = await supa
    .from('businesses')
    .select('id')
    .or('name.eq.Beauty Asiul,email.eq.luisa.bernal@example.com');

  if (businessError) {
    console.error('[SEED] Error checking for existing business, skipping cleanup:', businessError);
  } else if (businesses && businesses.length > 0) {
    const businessId = businesses[0].id;
    console.log(`[SEED] Found existing business with ID: ${businessId}. Cleaning up...`);
    await clearBusinessDataById(supa, businessId);
  } else {
    console.log('[SEED] No existing Luisa business found to clean up.');
  }

  // --- CREATE NEW BUSINESS ---
  console.log('[SEED] Creating new business...');
  const businessData: BusinessData = {
    name: 'Beauty Asiul',
    email: 'luisa.bernal@example.com',
    phone: '+61452678816',
    timeZone: 'Australia/Sydney',
    interfaceType: 'whatsapp',
    whatsappNumber: '+61411851098',
    businessAddress: '9 Dryburgh st, West Melbourne, VIC 3003',
  };

  const businessInstance = new Business(businessData);
  const createdBusiness = await businessInstance.add();
  
  if (!createdBusiness.id) {
    throw new Error('[SEED] Failed to create test business for Luisa - No ID returned');
  }
  console.log(`[SEED] Business '${createdBusiness.name}' created with ID: ${createdBusiness.id}`);

  // --- CREATE OWNER PROVIDER ---
  console.log('[SEED] Creating owner provider...');
  const ownerProvider = new User(
    'Luisa', 
    'Bernal', 
    'admin/provider' as UserRole,
    createdBusiness.id
  );

  const { data: createdUser, error: userError } = await ownerProvider.add({
    email: businessData.email,
    password: 'password123'
  });
  if (userError || !createdUser?.id) {
    throw new Error(`[SEED] Failed to create user: ${userError ? String(userError) : 'No user data returned'}`);
  }
  console.log(`[SEED] User '${createdUser.firstName} ${createdUser.lastName}' created with ID: ${createdUser.id}`);

  // --- CREATE SERVICES ---
  console.log('[SEED] Creating services...');
  const serviceIds: string[] = [];
  const servicesData: Omit<ServiceData, 'businessId' | 'id'>[] = [
    {
      name: 'Basic Pedicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 45.00,
      description: 'Classic pedicure treatment.',
      durationEstimate: 60, 
      mobile: false, 
    },
    {
      name: 'Gel Pedicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 50.00,
      description: 'Pedicure with long-lasting gel polish.',
      durationEstimate: 75,
      mobile: false,
    },
    {
      name: 'Nail Art (Add-on)',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 10.00, 
      description: 'Custom nail art design, per 2-4 nails.',
      durationEstimate: 20, 
      mobile: false,
    },
    {
      name: 'Manicure Basic',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 35.00,
      description: 'Classic manicure treatment.',
      durationEstimate: 45, 
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
    const createdService = await serviceInstance.add();
    
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
  
  const calendarSettingsInstance = await CalendarSettings.save(undefined, calendarSettingsData);
  if (!calendarSettingsInstance.id) {
    throw new Error('[SEED] Failed to create calendar settings - No ID returned');
  }
  console.log(`[SEED] Calendar settings created with ID: ${calendarSettingsInstance.id}`);

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
  const initialAvailability = await computeInitialAvailability(userInstance, fromDate, 30, businessInstance);
  await Promise.all(initialAvailability.map(slots => slots.add()));
  
  console.log(`[SEED] Created initial availability for ${initialAvailability.length} days`);

  console.log('[SEED] Database seeding completed successfully!');
  
  return {
    businessId: createdBusiness.id,
    ownerProviderId: createdUser.id,
    serviceIds,
    calendarSettingsId: calendarSettingsInstance.id
  };
} 