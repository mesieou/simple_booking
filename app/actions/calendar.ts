'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CalendarSettings = {
  user_id: string
  business_id: string
  calendar_id: string
  calendar_type: 'google' | 'outlook'
  settings?: Record<string, any>
}

export async function saveCalendarSettings(settings: CalendarSettings) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('calendar_settings')
    .upsert({
      ...settings,
      last_sync: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving calendar settings:', error)
    throw error
  }

  revalidatePath('/settings/calendar')
  return data
}

export async function getCalendarSettings(businessId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('calendar_settings')
    .select('*')
    .eq('business_id', businessId)

  if (error) {
    console.error('Error fetching calendar settings:', error)
    throw error
  }

  return data
}

export async function deleteCalendarSettings(businessId: string, userId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('calendar_settings')
    .delete()
    .eq('business_id', businessId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting calendar settings:', error)
    throw error
  }

  revalidatePath('/settings/calendar')
} 