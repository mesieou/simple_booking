import { getCalendarSettings } from '@/app/actions/calendar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function CalendarSettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('businessId')
    .eq('id', user.id)
    .single()

  if (!userData?.businessId) redirect('/')

  const calendarSettings = await getCalendarSettings(userData.businessId)

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Calendar Settings</h1>
      
      <div className="grid gap-6">
        {calendarSettings?.map((setting) => (
          <div key={setting.id} className="p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">
              {setting.calendar_type === 'google' ? 'Google Calendar' : 'Outlook Calendar'}
            </h2>
            <p className="text-sm text-gray-500">
              Last synced: {new Date(setting.last_sync).toLocaleString()}
            </p>
            <div className="mt-4">
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                onClick={() => {
                  // TODO: Implement calendar sync
                }}
              >
                Sync Calendar
              </button>
            </div>
          </div>
        ))}

        {(!calendarSettings || calendarSettings.length === 0) && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No calendar connected yet</p>
            <button
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              onClick={() => {
                // TODO: Implement calendar connection
              }}
            >
              Connect Calendar
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 