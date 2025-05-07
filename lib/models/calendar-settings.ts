import { createClient } from "@/lib/supabase/server";

export type WorkingHours = {
  start: string
  end: string
} | null

export type ProviderWorkingHours = {
  monday: WorkingHours
  tuesday: WorkingHours
  wednesday: WorkingHours
  thursday: WorkingHours
  friday: WorkingHours
  saturday: WorkingHours
  sunday: WorkingHours
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

export class CalendarSettingsError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'CalendarSettingsError';
  }
}

export class CalendarSettings {
  private data: CalendarSettingsData
  private _id?: string

  constructor(data: CalendarSettingsData) {
    if (!data.userId) throw new CalendarSettingsError("User ID is required");
    if (!data.businessId) throw new CalendarSettingsError("Business ID is required");
    if (!data.workingHours) throw new CalendarSettingsError("Working hours are required");
    
    this.data = data;
  }

  // Save or update calendar settings
  static async save(id: string | undefined, settings: CalendarSettingsData): Promise<CalendarSettings> {
    const supabase = createClient()
    
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
      console.error('Calendar settings save error:', error);
      throw new CalendarSettingsError("Failed to save calendar settings", error);
    }

    if (!data) {
      throw new CalendarSettingsError("Failed to save calendar settings: No data returned");
    }

    const calendarSettings = new CalendarSettings(data);
    calendarSettings._id = data.id;
    return calendarSettings;
  }

  // Get calendar settings for a business
  static async getByBusiness(businessId: string): Promise<CalendarSettings[]> {
    if (!CalendarSettings.isValidUUID(businessId)) {
      throw new CalendarSettingsError("Invalid business ID format");
    }

    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('businessId', businessId)

    if (error) {
      throw new CalendarSettingsError("Failed to fetch calendar settings by business", error);
    }

    return data.map(settings => {
      const calendarSettings = new CalendarSettings(settings);
      calendarSettings._id = settings.id;
      return calendarSettings;
    });
  }

  // Get calendar settings for a specific user in a business
  static async getByUserAndBusiness(userId: string, businessId: string): Promise<CalendarSettings> {
    if (!CalendarSettings.isValidUUID(userId)) {
      throw new CalendarSettingsError("Invalid user ID format");
    }
    if (!CalendarSettings.isValidUUID(businessId)) {
      throw new CalendarSettingsError("Invalid business ID format");
    }

    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('userId', userId)
      .eq('businessId', businessId)
      .single()

    if (error) {
      throw new CalendarSettingsError("Failed to fetch calendar settings by user and business", error);
    }

    if (!data) {
      throw new CalendarSettingsError(`No settings found for user ${userId} in business ${businessId}`);
    }

    const calendarSettings = new CalendarSettings(data);
    calendarSettings._id = data.id;
    return calendarSettings;
  }

  // Delete calendar settings
  static async delete(id: string): Promise<void> {
    if (!CalendarSettings.isValidUUID(id)) {
      throw new CalendarSettingsError("Invalid settings ID format");
    }

    const supabase = createClient()
    
    const { error } = await supabase
      .from('calendarSettings')
      .delete()
      .eq('id', id)

    if (error) {
      throw new CalendarSettingsError("Failed to delete calendar settings", error);
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
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: null,
      sunday: null
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