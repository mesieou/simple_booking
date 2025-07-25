import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
import { handleModelError } from '@/lib/general-helpers/error-handling/model-error-handler';

export type WorkingHours = {
  start: string
  end: string
} | null

export type ProviderWorkingHours = {
  mon: WorkingHours
  tue: WorkingHours
  wed: WorkingHours
  thu: WorkingHours
  fri: WorkingHours
  sat: WorkingHours
  sun: WorkingHours
}

export interface CalendarSettingsData {
  userId: string // Actual database field name (not providerId)
  businessId: string
  workingHours: ProviderWorkingHours
  timezone?: string
  manageCalendar?: boolean
  calendarId?: string
  calendarType?: 'google' | 'outlook'
  settings?: {
    bufferTime?: number
    timezone?: string
  }
  lastSync?: string
}

export class CalendarSettings {
  private data: CalendarSettingsData
  private _id?: string

  constructor(data: CalendarSettingsData) {
    if (!data.userId) handleModelError("User ID is required", new Error("Missing userId"));
    if (!data.businessId) handleModelError("Business ID is required", new Error("Missing businessId"));
    if (!data.workingHours) handleModelError("Working hours are required", new Error("Missing workingHours"));
    
    this.data = data;
  }

  // Save or update calendar settings
  static async save(id: string | undefined, settings: CalendarSettingsData, options?: { useServiceRole?: boolean; supabaseClient?: any }): Promise<CalendarSettings> {
    // Use provided client, service role client, or regular client
    // This bypasses RLS for scenarios like seeding where no user auth context exists
    const supabase = options?.supabaseClient || (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());
    
    const dataToSave = {
      userId: settings.userId, // Database uses userId column
      businessId: settings.businessId,
      workingHours: settings.workingHours,
      calendarId: settings.calendarId,
      calendarType: settings.calendarType,
      settings: settings.settings || {}, // Required JSONB field
      updatedAt: new Date().toISOString()
    }
    
    if (options?.useServiceRole) {
      console.log('[CalendarSettings.save] Using service role client (bypasses RLS for calendar settings creation)');
    }

    // If we have an ID, use update, otherwise insert
    const { data, error } = id 
      ? await supabase
          .from('calendarSettings')
          .update(dataToSave)
          .eq('id', id)
          .select()
          .single()
      : await supabase
          .from('calendarSettings')
          .insert(dataToSave)
          .select()
          .single()

    if (error) {
      handleModelError("Failed to save calendar settings", error);
    }

    if (!data) {
      handleModelError("Failed to save calendar settings: No data returned", new Error("No data returned from save"));
    }

    const calendarSettings = new CalendarSettings({
      userId: data.userId,
      businessId: data.businessId,
      workingHours: data.workingHours,
      timezone: data.timezone,
      manageCalendar: data.manageCalendar,
      calendarId: data.calendarId,
      calendarType: data.calendarType,
      settings: data.settings,
      lastSync: data.lastSync
    });
    calendarSettings._id = data.id;
    return calendarSettings;
  }

  // Get calendar settings for a business
  static async getByBusiness(businessId: string, options?: { useServiceRole?: boolean; supabaseClient?: any }): Promise<CalendarSettings[]> {
    if (!CalendarSettings.isValidUUID(businessId)) {
      handleModelError("Invalid business ID format", new Error("Invalid UUID format"));
    }

    const supabase = options?.supabaseClient || 
        (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient())
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('businessId', businessId)

    if (error) {
      handleModelError("Failed to fetch calendar settings by business", error);
    }

    return data.map((settings: any) => {
      const calendarSettings = new CalendarSettings({
        userId: settings.userId,
        businessId: settings.businessId,
        workingHours: settings.workingHours,
        timezone: settings.timezone,
        manageCalendar: settings.manageCalendar,
        calendarId: settings.calendarId,
        calendarType: settings.calendarType,
        settings: settings.settings,
        lastSync: settings.lastSync
      });
      calendarSettings._id = settings.id;
      return calendarSettings;
    });
  }

  // Get calendar settings for a specific user in a business
  static async getByUserAndBusiness(userId: string, businessId: string, options?: { supabaseClient?: any }): Promise<CalendarSettings | null> {
    if (!CalendarSettings.isValidUUID(userId)) {
      handleModelError("Invalid user ID format", new Error("Invalid UUID format"));
    }
    if (!CalendarSettings.isValidUUID(businessId)) {
      handleModelError("Invalid business ID format", new Error("Invalid UUID format"));
    }

    const supabase = options?.supabaseClient || await getEnvironmentServerClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('userId', userId) // Database uses userId field
      .eq('businessId', businessId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No settings found is a valid case, not an error.
      }
      handleModelError("Failed to fetch calendar settings by user and business", error);
    }

    if (!data) {
      return null; // Explicitly return null if no data is found
    }

    const calendarSettings = new CalendarSettings({
      userId: data.userId,
      businessId: data.businessId,
      workingHours: data.workingHours,
      timezone: data.timezone,
      manageCalendar: data.manageCalendar,
      calendarId: data.calendarId,
      calendarType: data.calendarType,
      settings: data.settings,
      lastSync: data.lastSync
    });
    calendarSettings._id = data.id;
    return calendarSettings;
  }

  // Delete calendar settings
  static async delete(id: string): Promise<void> {
    if (!CalendarSettings.isValidUUID(id)) {
      handleModelError("Invalid settings ID format", new Error("Invalid UUID format"));
    }

    const supabase = await getEnvironmentServerClient()
    
    const { error } = await supabase
      .from('calendarSettings')
      .delete()
      .eq('id', id)

    if (error) {
      handleModelError("Failed to delete calendar settings", error);
    }
  }

  /**
   * Delete calendar settings by user ID
   */
  static async deleteByUser(userId: string, options?: { supabaseClient?: any }): Promise<void> {
    const supa = options?.supabaseClient || getEnvironmentServiceRoleClient();
    const { error } = await supa
      .from('calendarSettings')
      .delete()
      .eq('userId', userId);

    if (error) {
      handleModelError(`Failed to delete calendar settings for user ${userId}`, error);
    }
  }

  // Helper method to validate working hours
  static validateWorkingHours(hours: ProviderWorkingHours): boolean {
    const days = Object.values(hours)
    return days.some(day => day !== null) // At least one day should have working hours
  }

  // Helper method to get default working hours
  static getDefaultWorkingHours(): ProviderWorkingHours {
    return {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: null,
      sun: null
    }
  }

  private static isValidUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  // Getters
  get id(): string | undefined { return this._id; }
  get userId(): string { return this.data.userId; }
  get providerId(): string { return this.data.userId; } // Alias for backward compatibility
  get businessId(): string { return this.data.businessId; }
  get workingHours(): ProviderWorkingHours { return this.data.workingHours; }
  get timezone(): string | undefined { return this.data.timezone; }
  get manageCalendar(): boolean | undefined { return this.data.manageCalendar; }
  get calendarId(): string | undefined { return this.data.calendarId; }
  get calendarType(): 'google' | 'outlook' | undefined { return this.data.calendarType; }
  get settings(): { bufferTime?: number; timezone?: string } | undefined { return this.data.settings; }
  get lastSync(): string | undefined { return this.data.lastSync; }
}