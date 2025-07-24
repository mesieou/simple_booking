import { User } from '../database/models/user';
import { CalendarSettings } from '../database/models/calendar-settings';
import { Business } from '../database/models/business';
import { getEnvironmentServiceRoleClient } from '../database/supabase/environment';
import { regenerateAllBusinessAvailability } from '../general-helpers/availability';

export interface ProviderCreationData {
  firstName: string;
  lastName: string;
  email?: string;
  workingHours?: any; // Use existing working hours format
  settings?: {
    bufferTime?: number;
    timezone?: string;
  };
}

export interface ProviderRemovalData {
  userId: string;
  reason?: 'business_downsize' | 'provider_left' | 'admin_removal';
}

/**
 * Add a new provider to a business with complete user lifecycle
 */
export async function addProviderToBusiness(
  businessId: string,
  providerData: ProviderCreationData,
  options?: { supabaseClient?: any }
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const adminSupa = options?.supabaseClient || getEnvironmentServiceRoleClient();
  
  try {
    console.log(`[addProviderToBusiness] Adding provider to business ${businessId}:`, providerData);
    
    // 1. Get business info
    const business = await Business.getById(businessId);
    if (!business.id) {
      throw new Error('Business not found');
    }
    
    // 2. Generate unique email if not provided
    const timestamp = Date.now();
    const sanitizedFirstName = providerData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = providerData.email || `${sanitizedFirstName}-${timestamp}@${business.email.split('@')[1]}`;
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    
    // 3. Create Auth User
    console.log(`[addProviderToBusiness] Creating auth user with email: ${email}`);
    const { data: authData, error: authError } = await adminSupa.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        firstName: providerData.firstName,
        lastName: providerData.lastName,
        role: 'provider',
        isAdditionalProvider: true,
        parentBusinessId: businessId
      }
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }

    const authUserId = authData.user.id;
    console.log(`[addProviderToBusiness] Auth user created with ID: ${authUserId}`);

    try {
      // 4. Create User Profile
      console.log(`[addProviderToBusiness] Creating user profile...`);
      const providerUser = new User(
        providerData.firstName,
        providerData.lastName,
        'provider',
        businessId,
        email
      );

      providerUser.id = authUserId;

      const userResult = await providerUser.add({
        email: email,
        password: tempPassword,
        skipProviderValidation: true,
        supabaseClient: adminSupa
      });

      if (!userResult) {
        throw new Error('Failed to create user profile');
      }

      console.log(`[addProviderToBusiness] User profile created with ID: ${providerUser.id}`);

      // 5. Create Calendar Settings
      console.log(`[addProviderToBusiness] Creating calendar settings...`);
      
      // Use provided working hours or get default from existing providers
      let workingHours = providerData.workingHours;
      if (!workingHours) {
        // Get default working hours from existing providers
        const existingSettings = await CalendarSettings.getByBusiness(businessId, { supabaseClient: adminSupa });
        workingHours = existingSettings.length > 0 ? existingSettings[0].workingHours : {
          mon: { start: '09:00', end: '17:00' },
          tue: { start: '09:00', end: '17:00' },
          wed: { start: '09:00', end: '17:00' },
          thu: { start: '09:00', end: '17:00' },
          fri: { start: '09:00', end: '17:00' },
          sat: null,
          sun: null
        };
      }

      const calendarSettingsData = {
        userId: authUserId,
        businessId: businessId,
        workingHours: workingHours,
        manageCalendar: false,
        settings: {
          bufferTime: providerData.settings?.bufferTime || 15,
          timezone: providerData.settings?.timezone || business.timeZone || 'Australia/Sydney'
        }
      };

      const calendarSettings = await CalendarSettings.save(undefined, calendarSettingsData, { 
        useServiceRole: true, 
        supabaseClient: adminSupa 
      });

      if (!calendarSettings) {
        throw new Error('Failed to create calendar settings');
      }

      console.log(`[addProviderToBusiness] Calendar settings created with ID: ${calendarSettings.id}`);

      // 6. Update business provider count
      console.log(`[addProviderToBusiness] Updating business numberOfProviders...`);
      const currentProviders = await CalendarSettings.getByBusiness(businessId, { supabaseClient: adminSupa });
      const newProviderCount = currentProviders.length;
      
      await adminSupa
        .from('businesses')
        .update({ numberOfProviders: newProviderCount })
        .eq('id', businessId);

      console.log(`[addProviderToBusiness] Updated business numberOfProviders to ${newProviderCount}`);

      // 7. Regenerate Availability
      console.log(`[addProviderToBusiness] Regenerating availability with new provider capacity...`);
      await regenerateAllBusinessAvailability(businessId, { supabaseClient: adminSupa });

      console.log(`[addProviderToBusiness] ✅ Successfully added provider ${providerData.firstName} ${providerData.lastName}`);

      return {
        success: true,
        userId: authUserId
      };

    } catch (error) {
      // Cleanup auth user if later steps fail
      console.error(`[addProviderToBusiness] Error in user creation steps, cleaning up auth user ${authUserId}:`, error);
      try {
        await adminSupa.auth.admin.deleteUser(authUserId);
      } catch (cleanupError) {
        console.error(`[addProviderToBusiness] Failed to cleanup auth user ${authUserId}:`, cleanupError);
      }
      throw error;
    }

  } catch (error) {
    console.error(`[addProviderToBusiness] Failed to add provider:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Remove a provider from a business with complete cleanup
 */
export async function removeProviderFromBusiness(
  businessId: string,
  removalData: ProviderRemovalData,
  options?: { supabaseClient?: any }
): Promise<{ success: boolean; error?: string }> {
  const adminSupa = options?.supabaseClient || getEnvironmentServiceRoleClient();
  
  try {
    console.log(`[removeProviderFromBusiness] Removing provider ${removalData.userId} from business ${businessId}`);
    
    // 1. Verify the user exists and belongs to this business
    const userToRemove = await User.getById(removalData.userId, { supabaseClient: adminSupa });
    if (!userToRemove || userToRemove.businessId !== businessId) {
      throw new Error('User not found or does not belong to this business');
    }

    if (userToRemove.role === 'admin' || userToRemove.role === 'admin/provider') {
      throw new Error('Cannot remove business owner/admin');
    }

    console.log(`[removeProviderFromBusiness] Verified user ${userToRemove.firstName} ${userToRemove.lastName} (${userToRemove.role})`);

    // 2. Delete Calendar Settings
    console.log(`[removeProviderFromBusiness] Deleting calendar settings...`);
    try {
      await CalendarSettings.deleteByUser(removalData.userId, { supabaseClient: adminSupa });
      console.log(`[removeProviderFromBusiness] Calendar settings deleted`);
    } catch (error) {
      console.error(`[removeProviderFromBusiness] Error deleting calendar settings:`, error);
      // Continue anyway
    }

    // 3. Delete User Profile
    console.log(`[removeProviderFromBusiness] Deleting user profile...`);
    try {
      await User.delete(removalData.userId, { supabaseClient: adminSupa });
      console.log(`[removeProviderFromBusiness] User profile deleted`);
    } catch (error) {
      console.error(`[removeProviderFromBusiness] Error deleting user profile:`, error);
      // Continue anyway
    }

    // 4. Delete Auth User
    console.log(`[removeProviderFromBusiness] Deleting auth user...`);
    try {
      const { error: authError } = await adminSupa.auth.admin.deleteUser(removalData.userId);
      if (authError) {
        console.error(`[removeProviderFromBusiness] Error deleting auth user:`, authError);
      } else {
        console.log(`[removeProviderFromBusiness] Auth user deleted`);
      }
    } catch (error) {
      console.error(`[removeProviderFromBusiness] Error deleting auth user:`, error);
      // Continue anyway
    }

    // 5. Update business provider count
    console.log(`[removeProviderFromBusiness] Updating business numberOfProviders...`);
    const remainingProviders = await CalendarSettings.getByBusiness(businessId, { supabaseClient: adminSupa });
    const newProviderCount = remainingProviders.length;
    
    await adminSupa
      .from('businesses')
      .update({ numberOfProviders: newProviderCount })
      .eq('id', businessId);

    console.log(`[removeProviderFromBusiness] Updated business numberOfProviders to ${newProviderCount}`);

    // 6. Regenerate Availability
    console.log(`[removeProviderFromBusiness] Regenerating availability with reduced provider capacity...`);
    await regenerateAllBusinessAvailability(businessId, { supabaseClient: adminSupa });

    console.log(`[removeProviderFromBusiness] ✅ Successfully removed provider ${userToRemove.firstName} ${userToRemove.lastName}`);

    return {
      success: true
    };

  } catch (error) {
    console.error(`[removeProviderFromBusiness] Failed to remove provider:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 