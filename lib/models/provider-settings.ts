import { createClient } from "@/lib/supabase/client"

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

export type ProviderSettings = {
  id?: string
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
  createdAt?: string
  updatedAt?: string
}

export class ProviderSettingsModel {
  private settings: ProviderSettings

  constructor(settings: ProviderSettings) {
    this.settings = settings
  }

  // Save or update provider settings
  async save() {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .upsert({
        ...this.settings,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving provider settings:', error)
      throw error
    }

    return data
  }

  // Get provider settings for a business
  static async getByBusiness(businessId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('businessId', businessId)

    if (error) {
      console.error('Error fetching provider settings:', error)
      throw error
    }

    return data
  }

  // Get provider settings for a specific user in a business
  static async getByUserAndBusiness(userId: string, businessId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('calendarSettings')
      .select('*')
      .eq('userId', userId)
      .eq('businessId', businessId)
      .single()

    if (error) {
      console.error('Error fetching provider settings:', error)
      throw error
    }

    return data
  }

  // Delete provider settings
  async delete() {
    if (!this.settings.id) {
      throw new Error('Cannot delete settings without an ID')
    }

    const supabase = createClient()
    
    const { error } = await supabase
      .from('calendarSettings')
      .delete()
      .eq('id', this.settings.id)

    if (error) {
      console.error('Error deleting provider settings:', error)
      throw error
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
} 