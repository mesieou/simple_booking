import { Business, type BusinessData } from '../models/business';
import { User, type UserRole } from '../models/user';
import { Service, type ServiceData, type PricingType } from '../models/service';
import { CalendarSettings, type CalendarSettingsData, type ProviderWorkingHours } from '../models/calendar-settings';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '../supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  await clearExistingLuisaBusiness(supa);

  // --- CREATE NEW BUSINESS ---
  console.log('[SEED] Creating new business...');
  const businessData: BusinessData = {
    name: 'Beauty Asiul',
    email: 'luisa.bernal7826@gmail.com',
    phone: '+61452678816',
    timeZone: 'Australia/Sydney',
    interfaceType: 'whatsapp',
    whatsappNumber: '+61404278733',
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

  const { data: createdUser, error: userError } = await ownerProvider.add();
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
      bufferTime: 15, 
      timezone: createdBusiness.timeZone,
    }
  };
  
  const calendarSettingsInstance = await CalendarSettings.save(undefined, calendarSettingsData);
  if (!calendarSettingsInstance.id) {
    throw new Error('[SEED] Failed to create calendar settings - No ID returned');
  }
  console.log(`[SEED] Calendar settings created with ID: ${calendarSettingsInstance.id}`);

  console.log('[SEED] Database seeding completed successfully!');
  
  return {
    businessId: createdBusiness.id,
    ownerProviderId: createdUser.id,
    serviceIds,
    calendarSettingsId: calendarSettingsInstance.id
  };
}

/**
 * Methodically clear all existing Luisa business data following proper deletion order
 */
async function clearExistingLuisaBusiness(supa: SupabaseClient): Promise<void> {
  console.log('[SEED] Checking for existing Luisa business...');
  
  // Find existing business
  const { data: businesses, error: businessError } = await supa
    .from('businesses')
    .select('id')
    .or('name.eq.Beauty Asiul,email.eq.luisa.bernal7826@gmail.com');

  if (businessError) {
    console.error('[SEED] Error checking for existing business:', businessError);
    return;
  }

  if (!businesses || businesses.length === 0) {
    console.log('[SEED] No existing Luisa business found.');
    return;
  }

  const businessId = businesses[0].id;
  console.log(`[SEED] Found existing business with ID: ${businessId}. Starting cleanup...`);

  // Get all users for this business (we'll need their auth IDs)
  const { data: users } = await supa
    .from('users')
    .select('id')
    .eq('businessId', businessId);

  const userIds = users?.map(u => u.id) || [];

  // Following the deletion order from clear-database.ts:
  // 1. embeddings, documents (usually not business-specific in this case)
  // 2. events (for users in this business)
  if (userIds.length > 0) {
    const { error: eventsError } = await supa
      .from('events')
      .delete()
      .in('userId', userIds);
    if (eventsError) console.log('[SEED] Note: Error deleting events:', eventsError.message);
  }

  // 3. bookings (for this business)
  const { error: bookingsError } = await supa
    .from('bookings')
    .delete()
    .eq('businessId', businessId);
  if (bookingsError) console.log('[SEED] Note: Error deleting bookings:', bookingsError.message);

  // 4. quotes (for this business)
  const { error: quotesError } = await supa
    .from('quotes')
    .delete()
    .eq('businessId', businessId);
  if (quotesError) console.log('[SEED] Note: Error deleting quotes:', quotesError.message);

  // 5. calendarSettings (for this business)
  const { error: calendarError } = await supa
    .from('calendarSettings')
    .delete()
    .eq('businessId', businessId);
  if (calendarError) console.log('[SEED] Note: Error deleting calendar settings:', calendarError.message);

  // 6. availabilitySlots (for users in this business)
  if (userIds.length > 0) {
    const { error: availabilityError } = await supa
      .from('availabilitySlots')
      .delete()
      .in('providerId', userIds);
    if (availabilityError) console.log('[SEED] Note: Error deleting availability slots:', availabilityError.message);
  }

  // 7. services (for this business)
  const { error: servicesError } = await supa
    .from('services')
    .delete()
    .eq('businessId', businessId);
  if (servicesError) console.log('[SEED] Note: Error deleting services:', servicesError.message);

  // 8. Delete auth users first, then database users
  for (const userId of userIds) {
    try {
      // Delete from Supabase Auth
      const { error: authError } = await supa.auth.admin.deleteUser(userId);
      if (authError) console.log(`[SEED] Note: Error deleting auth user ${userId}:`, authError.message);
    } catch (error) {
      console.log(`[SEED] Note: Could not delete auth user ${userId}`);
    }
  }

  // Also delete the specific Luisa auth user by email (in case it's orphaned)
  try {
    const { data: authUsers } = await supa.auth.admin.listUsers();
    const luisaAuthUser = authUsers.users.find(u => u.email === 'luisa.bernal@example.com');
    if (luisaAuthUser) {
      const { error: luisaAuthError } = await supa.auth.admin.deleteUser(luisaAuthUser.id);
      if (luisaAuthError) console.log(`[SEED] Note: Error deleting Luisa auth user:`, luisaAuthError.message);
      else console.log(`[SEED] Deleted orphaned Luisa auth user`);
    }
  } catch (error) {
    console.log(`[SEED] Note: Could not check/delete Luisa auth user`);
  }

  // Delete users from database
  if (userIds.length > 0) {
    const { error: usersError } = await supa
      .from('users')
      .delete()
      .eq('businessId', businessId);
    if (usersError) console.log('[SEED] Note: Error deleting users:', usersError.message);
  }

  // 9. Finally delete the business
  const { error: businessDeleteError } = await supa
    .from('businesses')
    .delete()
    .eq('id', businessId);
  
  if (businessDeleteError) {
    throw new Error(`[SEED] Failed to delete business: ${businessDeleteError.message}`);
  }

  console.log(`[SEED] Successfully cleaned up existing business and all related data.`);
} 