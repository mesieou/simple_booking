import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
import { Business } from "./business";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

export type UserRole = "super_admin" | "admin" | "provider" | "customer" | "admin/provider" | "staff";

// Provider roles that can have availability
export const PROVIDER_ROLES: UserRole[] = ["provider", "admin/provider", "admin", "staff"];

// Superadmin roles that have access to all businesses
export const SUPERADMIN_ROLES: UserRole[] = ["super_admin", "admin"];

/**
 * Phone number normalization utility
 */
class PhoneNumberUtils {
    /**
     * Normalizes phone number for comparison by removing + and non-digits
     * @param phone - Phone number to normalize
     * @returns Normalized phone number (digits only)
     */
    static normalize(phone: string): string {
        return phone.replace(/[^\d]/g, '');
    }

    /**
     * Adds + prefix to phone number if not present
     * @param phone - Phone number
     * @returns Phone number with + prefix
     */
    static addPlusPrefix(phone: string): string {
        const normalized = phone.replace(/[^\d]/g, '');
        return `+${normalized}`;
    }

    /**
     * Formats normalized phone number for display
     * @param normalizedPhone - Normalized phone number (digits only)
     * @returns Formatted phone number with + and spaces
     */
    static formatForDisplay(normalizedPhone: string): string {
        if (!normalizedPhone) return '';
        
        // Add + prefix
        const withPlus = `+${normalizedPhone}`;
        
        // Format based on length (basic formatting)
        if (normalizedPhone.length >= 10) {
            // International format: +XX XXX XXX XXX
            return withPlus.replace(/(\+\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
        }
        
        return withPlus;
    }
}

/**
 * User class representing a user in the system.
 * Provider roles include:
 * - "provider": Standard provider role
 * - "admin/provider": User with both admin and provider capabilities
 */
export class User {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    businessId: string;
    email?: string;
    phoneNormalized?: string; // Store phone numbers as digits only
    whatsAppNumberNormalized?: string;

    constructor(
        firstName: string,
        lastName: string,
        role: UserRole,
        businessId: string,
        email?: string,
        phoneNormalized?: string,
        whatsAppNumberNormalized?: string
    ) {
        this.id = uuidv4();
        this.firstName = firstName;
        this.lastName = lastName;
        this.role = role;
        this.businessId = businessId;
        this.email = email;
        this.phoneNormalized = phoneNormalized;
        this.whatsAppNumberNormalized = whatsAppNumberNormalized;
    }

      //creates a user in supa
  async add(options?: { 
    email?: string; 
    password?: string; 
    whatsappNumber?: string; 
    skipProviderValidation?: boolean; // Allow skipping for seed scripts
    supabaseClient?: any; // Allow passing a specific client (for production seeding)
  }) {
    // Use provided client or default service role for ALL operations in user creation
    // This avoids RLS context mismatch between auth and database operations
    const adminSupa = options?.supabaseClient || getEnvironmentServiceRoleClient();

        // Validate: prevent multiple providers per business (unless explicitly skipped)
        if (!options?.skipProviderValidation && PROVIDER_ROLES.includes(this.role)) {
            const hasExistingProvider = await User.businessHasProvider(this.businessId, adminSupa);
            if (hasExistingProvider) {
                handleModelError(
                    `Business ${this.businessId} already has a provider. Only one provider per business is allowed.`, 
                    new Error("Multiple providers not allowed")
                );
            }
        }

        // Use provided email or generate default with proper sanitization
        const sanitizeEmailPart = (str: string) => {
            return str
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
                .substring(0, 20); // Limit length
        };
        
        const sanitizedFirstName = sanitizeEmailPart(this.firstName);
        const sanitizedLastName = sanitizeEmailPart(this.lastName);
        
        // Generate a valid email address
        let generatedEmail: string;
        if (sanitizedLastName) {
            generatedEmail = `${sanitizedFirstName}.${sanitizedLastName}@example.com`;
        } else {
            generatedEmail = `${sanitizedFirstName}@example.com`;
        }
        
        const email = options?.email || generatedEmail;
        const password = options?.password || 'password123';

        // Prepare user_metadata
        const user_metadata: any = {
            firstName: this.firstName,
            lastName: this.lastName,
            role: this.role
        };
        if (options?.whatsappNumber) {
            user_metadata.whatsappNumber = options.whatsappNumber;
        }

        // --- Find or Create Auth User ---
        let authUser;
        const { data: { users }, error: listError } = await adminSupa.auth.admin.listUsers();
        if(listError) handleModelError("Failed to list auth users", listError);
        
        const existingAuthUser = users.find((u: any) => u.email === email);

        if (existingAuthUser) {
            console.log(`[User.add] Found existing auth user with email: ${email}`);
            authUser = existingAuthUser;
        } else {
            console.log(`[User.add] No existing auth user found. Creating new one.`);
            const { data: newAuthData, error: createError } = await adminSupa.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: user_metadata
            });

            if (createError) handleModelError("Failed to create auth user", createError);
            if (!newAuthData.user) handleModelError("No user data returned from auth creation", new Error("No auth user data"));
            
            authUser = newAuthData.user;
        }

        // --- Upsert User Profile ---
        const userProfile: any = {
            id: authUser.id,
            firstName: this.firstName,
            lastName: this.lastName,
            role: this.role,
            businessId: this.businessId,
            email: this.email || options?.email || email, // Store provider email
            phoneNormalized: this.phoneNormalized, // Store normalized phone (digits only)
        };
        
        // Add WhatsApp number fields if provided
        if (options?.whatsappNumber) {
            userProfile.whatsAppNumberNormalized = PhoneNumberUtils.normalize(options.whatsappNumber);
        }

        // Debug logging for bot operations
        console.log('[User.add] About to upsert user profile:', userProfile);
        console.log('[User.add] Using adminSupa client (bypasses RLS for user creation)');
        
        const { data, error } = await adminSupa
            .from("users")
            .upsert(userProfile)
            .select()
            .single();

        if (error) {
            // Enhanced error logging for debugging
            console.error('[User.add] Upsert failed with error:', error);
            console.error('[User.add] Error details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            console.error('[User.add] Failed userProfile:', userProfile);
            handleModelError("Failed to upsert user profile", error);
        }

        if (!data) {
            handleModelError("Failed to upsert user profile: No data returned", new Error("No data returned from upsert"));
        }

        this.id = authUser.id;

        return { data, error: null }; // Return null for error as we handle it
    }

    // Get user by ID
    static async getById(id: string, options?: { useServiceRole?: boolean; supabaseClient?: any }): Promise<User> {
        if (!User.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = options?.supabaseClient ||
            (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());

        if (options?.useServiceRole) {
            console.log('[User.getById] Using service role client (bypasses RLS for user retrieval)');
        }

        const { data, error } = await supa.from("users").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch user", error);
        }
        
        if (!data) {
            handleModelError(`User with id ${id} not found`, new Error("User not found"));
        }
        
        const user = new User(
            data.firstName, 
            data.lastName, 
            data.role, 
            data.businessId,
            data.email,
            data.phoneNormalized,
            data.whatsAppNumberNormalized
        );
        user.id = data.id; // Set the actual database ID
        return user;
    }

    // Get users by business
    static async getByBusiness(businessId: string): Promise<User[]> {
        if (!User.isValidUUID(businessId)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await getEnvironmentServerClient()
        const { data, error } = await supa.from("users").select("*").eq("businessId", businessId);
        
        if (error) {
            handleModelError("Failed to fetch users by business", error);
        }
        
        return data.map(userData => {
            const user = new User(
                userData.firstName, 
                userData.lastName, 
                userData.role, 
                userData.businessId,
                userData.email,
                userData.phoneNormalized,
                userData.whatsAppNumberNormalized
            );
            user.id = userData.id; // Set the actual database ID
            return user;
        });
    }

    // Get users by role
    static async getByRole(role: UserRole): Promise<User[]> {
        const supa = await getEnvironmentServerClient()
        const { data, error } = await supa.from("users").select("*").eq("role", role);
        
        if (error) {
            handleModelError("Failed to fetch users by role", error);
        }
        
        return data.map(userData => {
            const user = new User(
                userData.firstName, 
                userData.lastName, 
                userData.role, 
                userData.businessId,
                userData.email,
                userData.phoneNormalized,
                userData.whatsAppNumberNormalized
            );
            user.id = userData.id; // Set the actual database ID
            return user;
        });
    }

    // Get all providers (including admin/providers)
    static async getAllProviders(): Promise<User[]> {
        const supa = getEnvironmentServiceRoleClient();
        const { data, error } = await supa
            .from('users')
            .select('*')
            .in('role', PROVIDER_ROLES);

        if (error) {
            handleModelError("Failed to get all providers", error);
        }

        return (data || []).map(userData => {
            const user = new User(userData.firstName, userData.lastName, userData.role, userData.businessId);
            user.id = userData.id;
            user.email = userData.email;
            user.phoneNormalized = userData.phoneNormalized;
            user.whatsAppNumberNormalized = userData.whatsAppNumberNormalized;
            return user;
        });
    }

    /**
     * Get users by business and role
     */
    static async getByBusinessAndRole(businessId: string, role: UserRole): Promise<User[]> {
        const supa = getEnvironmentServiceRoleClient();
        const { data, error } = await supa
            .from('users')
            .select('*')
            .eq('businessId', businessId)
            .eq('role', role);

        if (error) {
            handleModelError(`Failed to get users by business ${businessId} and role ${role}`, error);
        }

        return (data || []).map(userData => {
            const user = new User(userData.firstName, userData.lastName, userData.role, userData.businessId);
            user.id = userData.id;
            user.email = userData.email;
            user.phoneNormalized = userData.phoneNormalized;
            user.whatsAppNumberNormalized = userData.whatsAppNumberNormalized;
            return user;
        });
    }

    // Get the user (owner) of a business by its ID
    static async findUserByBusinessId(businessId: string): Promise<User | null> {
        if (!User.isValidUUID(businessId)) {
            handleModelError("Invalid businessId UUID format", new Error("Invalid UUID"));
        }
        
        try {
            const supa = await getEnvironmentServerClient();
            // Find a user associated with the business who is a provider/admin
            const { data: users, error } = await supa
                .from('users')
                .select('*')
                .eq('businessId', businessId)
                .in('role', PROVIDER_ROLES); 

            if (error) {
                console.error(`[User] Error fetching user for businessId ${businessId}:`, error);
                return null;
            }

            if (!users || users.length === 0) {
                console.log(`[User] No admin/provider user found for businessId: ${businessId}`);
                return null;
            }

            // Log if multiple providers found (this should not happen in production)
            if (users.length > 1) {
                console.warn(`[User] MULTIPLE PROVIDERS FOUND for business ${businessId}:`, 
                    users.map(u => `${u.id} (${u.firstName} ${u.lastName}, role: ${u.role})`));
                console.warn(`[User] This business has ${users.length} providers. Only one provider per business is recommended.`);
            }

            // Prioritize admin/provider over regular provider for deterministic selection
            const adminProvider = users.find(u => u.role === 'admin/provider');
            const ownerData = adminProvider || users[0];
            
            console.log(`[User] Selected provider: ${ownerData.id} (${ownerData.firstName} ${ownerData.lastName}, role: ${ownerData.role})`);
            
            const user = new User(
                ownerData.firstName, 
                ownerData.lastName, 
                ownerData.role, 
                ownerData.businessId,
                ownerData.email,
                ownerData.phoneNormalized,
                ownerData.whatsAppNumberNormalized
            );
            user.id = ownerData.id;
            return user;

        } catch (error) {
            console.error(`[User] Exception in findUserByBusinessId for ${businessId}:`, error);
            return null;
        }
    }

    // Unified method for finding user by business phone or WhatsApp number - FIXED
    private static async findUserByBusinessContact(phoneNumber: string, contactType: 'phone' | 'whatsapp' | 'both' = 'both'): Promise<User | null> {
        try {
            console.log(`[User] Finding user by business ${contactType} contact: ${phoneNumber}`);
            
            const supa = await getEnvironmentServerClient();
            
            // Normalize the input phone number for comparison
            const normalizedInputNumber = PhoneNumberUtils.normalize(phoneNumber);
            console.log(`[User] Normalized input number: ${normalizedInputNumber}`);
            
            let businessData = null;
            
            if (contactType === 'phone' || contactType === 'both') {
                // Try to find business by phone number first
                const { data, error } = await supa
                    .from('businesses')
                    .select('id, phone')
                    .not('phone', 'is', null);
                    
                if (!error && data) {
                    businessData = data.find(business => {
                        const normalizedBusinessPhone = PhoneNumberUtils.normalize(business.phone || '');
                        return normalizedBusinessPhone === normalizedInputNumber;
                    });
                }
            }
            
            if (!businessData && (contactType === 'whatsapp' || contactType === 'both')) {
                // Try to find business by WhatsApp number - USE DETAILED LOGGING
                const { data, error } = await supa
                    .from('businesses')
                    .select('id, whatsappNumber')
                    .not('whatsappNumber', 'is', null);
                    
                if (!error && data) {
                    console.log(`[User] Checking ${data.length} businesses with WhatsApp numbers`);
                    businessData = data.find(business => {
                        const normalizedBusinessWhatsapp = PhoneNumberUtils.normalize(business.whatsappNumber || '');
                        console.log(`[User] Comparing input ${normalizedInputNumber} with business ${business.id} WhatsApp: ${normalizedBusinessWhatsapp}`);
                        return normalizedBusinessWhatsapp === normalizedInputNumber;
                    });
                }
            }
                
            if (!businessData) {
                console.log(`[User] No business found for ${contactType} contact:`, normalizedInputNumber);
                return null;
            }
            
            console.log(`[User] Found business ID: ${businessData.id}`);
            
            // Now find the user who owns this business - IMPROVED ERROR HANDLING
            const { data: userData, error: userError } = await supa
                .from('users')
                .select('*')
                .eq('businessId', businessData.id);
                
            if (userError) {
                console.error('[User] Error querying users table:', userError);
                return null;
            }
                
            if (!userData || userData.length === 0) {
                console.log('[User] No user found who owns this business:', businessData.id);
                // Let's also check what users exist in the database
                const { data: allUsers } = await supa.from('users').select('id, firstName, role, businessId');
                console.log('[User] All users in database:', allUsers);
                return null;
            }
            
            // Take the first user if multiple (shouldn't happen but just in case)
            const userRecord = userData[0];
            console.log(`[User] Found user who owns the business, user ID: ${userRecord.id}`);
            
            const user = new User(
                userRecord.firstName, 
                userRecord.lastName, 
                userRecord.role, 
                userRecord.businessId,
                userRecord.email,
                userRecord.phoneNormalized,
                userRecord.whatsAppNumberNormalized
            );
            user.id = userRecord.id; // Set the actual database ID
            return user;
        } catch (error) {
            console.error(`[User] Error finding user by business ${contactType} contact:`, error);
            return null;
        }
    }

    // Get user by phone number (looks up business first, then associated user) - UPDATED to use unified method
    static async getByPhoneNumber(phoneNumber: string): Promise<User | null> {
        return this.findUserByBusinessContact(phoneNumber, 'both');
    }

    // Get user by business WhatsApp number (finds the user who owns the business with this WhatsApp number) - UPDATED to use unified method
    static async findUserByBusinessWhatsappNumber(businessWhatsappNumber: string): Promise<User | null> {
        return this.findUserByBusinessContact(businessWhatsappNumber, 'whatsapp');
    }

    // Get user by customer WhatsApp number (finds customers by their WhatsApp number in user_metadata)
    static async findUserByCustomerWhatsappNumber(customerWhatsappNumber: string): Promise<User | null> {
        try {
            console.log(`[User] Finding customer user by WhatsApp number: ${customerWhatsappNumber}`);
            
            // Use the service role client to bypass RLS for this global search
            const supa = getEnvironmentServiceRoleClient();
            
            // Normalize the input WhatsApp number for comparison
            const normalizedInputWhatsappNumber = PhoneNumberUtils.normalize(customerWhatsappNumber);
            console.log(`[User] Normalized input customer WhatsApp number: ${normalizedInputWhatsappNumber}`);
            
            // Query the public.users table directly on the normalized number, but ONLY for customer role
            const { data: userData, error: userError } = await supa
                .from('users')
                .select('*')
                .eq('whatsAppNumberNormalized', normalizedInputWhatsappNumber)
                .eq('role', 'customer') // Only look for customer users, not admins or providers
                .maybeSingle(); // Use maybeSingle() as it's possible no user is found
            
            if (userError) {
                console.error('[User] Error finding customer user by WhatsApp number:', userError);
                // Don't throw, just return null as the user might be new.
                return null;
            }

            if (!userData) {
                console.log('[User] No customer user found with this WhatsApp number:', normalizedInputWhatsappNumber);
                return null;
            }
            
            console.log(`[User] Found customer user record for WhatsApp number, user ID: ${userData.id}`);
            
            const user = new User(
                userData.firstName, 
                userData.lastName, 
                userData.role, 
                userData.businessId,
                userData.email,
                userData.phoneNormalized,
                userData.whatsAppNumberNormalized
            );
            user.id = userData.id; // Set the actual database ID
            return user;

        } catch (error) {
            console.error('[User] Exception in findUserByCustomerWhatsappNumber:', error);
            return null;
        }
    }

    // Update user
    static async update(id: string, userData: { firstName: string, lastName: string, role: UserRole, businessId: string, whatsappNumber?: string }): Promise<User> {
        if (!User.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await getEnvironmentServerClient()
        const updateData: any = {
            "firstName": userData.firstName,
            "lastName": userData.lastName,
            "role": userData.role,
            "businessId": userData.businessId,
        }
        
        // Add WhatsApp number fields if provided
        if (userData.whatsappNumber) {
            updateData.whatsAppNumberNormalized = PhoneNumberUtils.normalize(userData.whatsappNumber);
        }
        
        const { data, error } = await supa
            .from("users")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            handleModelError("Failed to update user", error);
        }

        if (!data) {
            handleModelError("Failed to update user: No data returned", new Error("No data returned from update"));
        }

        const updatedUser = new User(
            data.firstName, 
            data.lastName, 
            data.role, 
            data.businessId,
            data.email,
            data.phoneNormalized,
            data.whatsAppNumberNormalized
        );
        updatedUser.id = data.id; // Set the actual database ID
        return updatedUser;
    }

    // Delete user
    static async delete(id: string, options?: { useServiceRole?: boolean; supabaseClient?: any }): Promise<void> {
        if (!User.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = options?.supabaseClient ||
            (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());

        if (options?.useServiceRole) {
            console.log('[User.delete] Using service role client (bypasses RLS for user deletion)');
        }

        const { error } = await supa.from("users").delete().eq("id", id);

        if (error) {
            handleModelError("Failed to delete user", error);
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // Getters for the user data
    get createdAt(): string | undefined { return undefined; }
    get updatedAt(): string | undefined { return undefined; }

    // Check if a business already has a provider
    static async businessHasProvider(businessId: string, supabaseClient?: any): Promise<boolean> {
        if (!User.isValidUUID(businessId)) {
            return false;
        }
        
        try {
            const supa = supabaseClient || await getEnvironmentServerClient();
            const { data: users, error } = await supa
                .from('users')
                .select('id')
                .eq('businessId', businessId)
                .in('role', PROVIDER_ROLES)
                .limit(1);

            if (error) {
                console.error(`[User] Error checking for existing providers in business ${businessId}:`, error);
                return false;
            }

            return (users && users.length > 0);
        } catch (error) {
            console.error(`[User] Exception checking for existing providers:`, error);
            return false;
        }
    }
}

