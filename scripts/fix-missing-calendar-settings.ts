import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';

async function fixMissingCalendarSettings() {
  console.log('🔧 Checking for providers missing calendar settings...');
  
  try {
    // Get all providers
    const providers = await User.getAllProviders();
    console.log(`Found ${providers.length} providers`);
    
    const providersToFix = [];
    
    // Check each provider for calendar settings
    for (const provider of providers) {
      console.log(`Checking provider: ${provider.firstName} ${provider.lastName} (${provider.id})`);
      
      try {
        const calendarSettings = await CalendarSettings.getByUserAndBusiness(
          provider.id,
          provider.businessId
        );
        
        if (!calendarSettings) {
          console.log(`❌ Provider ${provider.firstName} ${provider.lastName} (${provider.id}) missing calendar settings`);
          providersToFix.push(provider);
        } else {
          console.log(`✅ Provider ${provider.firstName} ${provider.lastName} has calendar settings`);
        }
      } catch (error) {
        console.log(`❌ Error checking calendar settings for ${provider.firstName} ${provider.lastName}:`, error);
        providersToFix.push(provider);
      }
    }
    
    if (providersToFix.length === 0) {
      console.log('🎉 All providers have calendar settings!');
      return;
    }
    
    console.log(`\n🔨 Fixing ${providersToFix.length} providers with missing calendar settings...`);
    
    // Fix each provider
    for (const provider of providersToFix) {
      try {
        console.log(`Fixing provider: ${provider.firstName} ${provider.lastName} (${provider.id})`);
        
        // Get the business to determine timezone
        const business = await Business.getById(provider.businessId);
        console.log(`Business: ${business.name}, timezone: ${business.timeZone}`);
        
        // Create default calendar settings
        const calendarSettings = await CalendarSettings.save(undefined, {
          userId: provider.id,
          businessId: provider.businessId,
          workingHours: {
            mon: { start: '09:00', end: '17:00' },
            tue: { start: '09:00', end: '17:00' },
            wed: { start: '09:00', end: '17:00' },
            thu: { start: '09:00', end: '17:00' },
            fri: { start: '09:00', end: '17:00' },
            sat: null,
            sun: null
          },
          settings: {
            timezone: business.timeZone, // Use business timezone
            bufferTime: 30 // 30 minute buffer
          }
        });
        
        console.log(`✅ Created calendar settings for ${provider.firstName} ${provider.lastName} (ID: ${calendarSettings.id})`);
        
      } catch (error) {
        console.error(`❌ Failed to create calendar settings for ${provider.firstName} ${provider.lastName}:`, error);
      }
    }
    
    console.log('\n🎉 Calendar settings fix completed!');
    console.log('Now the cron job should work properly for all providers.');
    
  } catch (error) {
    console.error('❌ Failed to fix calendar settings:', error);
  }
}

// Export for use in other scripts
export { fixMissingCalendarSettings };

// If running directly, execute the fix
if (require.main === module) {
  fixMissingCalendarSettings();
} 