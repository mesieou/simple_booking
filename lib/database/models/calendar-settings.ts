import { createClient } from "../supabase/server";
import { handleModelError } from '@/lib/general-helpers/error';

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
  userId: string
  businessId: string
  workingHours: ProviderWorkingHours
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
  static async save(id: string | undefined, settings: CalendarSettingsData): Promise<CalendarSettings> {
    const supabase = await createClient()
    
    const dataToSave = {
      ...settings,
      updatedAt: new Date().toISOString()
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

    const calendarSettings = new CalendarSettings(data);
    calendarSettings._id = data.id;
    return calendarSettings;
  }

  // Get calendar settings for a business
  static async getByBusiness(businessId: string): Promise<CalendarSettings[]> {
    if (!CalendarSettings.isValidUUID(businessId)) {
      handleModelError("Invalid business ID format", new Error("Invalid UUID format"));
    }

    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('businessId', businessId)

    if (error) {
      handleModelError("Failed to fetch calendar settings by business", error);
    }

    return data.map(settings => {
      const calendarSettings = new CalendarSettings(settings);
      calendarSettings._id = settings.id;
      return calendarSettings;
    });
  }

  // Get calendar settings for a specific user in a business
  static async getByUserAndBusiness(userId: string, businessId: string): Promise<CalendarSettings | null> {
    if (!CalendarSettings.isValidUUID(userId)) {
      handleModelError("Invalid user ID format", new Error("Invalid UUID format"));
    }
    if (!CalendarSettings.isValidUUID(businessId)) {
      handleModelError("Invalid business ID format", new Error("Invalid UUID format"));
    }

    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('userId', userId)
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

    const calendarSettings = new CalendarSettings(data);
    calendarSettings._id = data.id;
    return calendarSettings;
  }

  // Delete calendar settings
  static async delete(id: string): Promise<void> {
    if (!CalendarSettings.isValidUUID(id)) {
      handleModelError("Invalid settings ID format", new Error("Invalid UUID format"));
    }

    const supabase = await createClient()
    
    const { error } = await supabase
      .from('calendarSettings')
      .delete()
      .eq('id', id)

    if (error) {
      handleModelError("Failed to delete calendar settings", error);
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
  get businessId(): string { return this.data.businessId; }
  get workingHours(): ProviderWorkingHours { return this.data.workingHours; }
  get manageCalendar(): boolean | undefined { return this.data.manageCalendar; }
  get calendarId(): string | undefined { return this.data.calendarId; }
  get calendarType(): 'google' | 'outlook' | undefined { return this.data.calendarType; }
  get settings(): { bufferTime?: number; timezone?: string } | undefined { return this.data.settings; }
  get lastSync(): string | undefined { return this.data.lastSync; }
}