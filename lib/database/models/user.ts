import { createClient } from "../supabase/server"
import { Business } from "./business";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

export type UserRole = "admin" | "provider" | "customer" | "admin/provider";

// Provider roles that can have availability
export const PROVIDER_ROLES: UserRole[] = ["provider", "admin/provider"];

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

    constructor(
        firstName: string,
        lastName: string,
        role: UserRole,
        businessId: string,
    ) {
        this.id = uuidv4();
        this.firstName = firstName;
        this.lastName = lastName;
        this.role = role;
        this.businessId = businessId;
    }

    //creates a user in supa
    async add(options?: { 
        email?: string; 
        password?: string; 
        whatsappNumber?: string; 
    }) {
        const supa = await createClient();

        // Use provided email or generate default
        const email = options?.email || `${this.firstName.toLowerCase()}.${this.lastName.toLowerCase()}@example.com`;
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
        const { data: { users }, error: listError } = await supa.auth.admin.listUsers();
        if(listError) handleModelError("Failed to list auth users", listError);
        
        const existingAuthUser = users.find(u => u.email === email);

        if (existingAuthUser) {
            console.log(`[User.add] Found existing auth user with email: ${email}`);
            authUser = existingAuthUser;
        } else {
            console.log(`[User.add] No existing auth user found. Creating new one.`);
            const { data: newAuthData, error: createError } = await supa.auth.admin.createUser({
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
        const userProfile = {
            id: authUser.id,
            firstName: this.firstName,
            lastName: this.lastName,
            role: this.role,
            businessId: this.businessId,
        };

        const { data, error } = await supa
            .from("users")
            .upsert(userProfile)
            .select()
            .single();

        if (error) {
            // If profile upsert fails, we don't necessarily need to delete the auth user anymore,
            // but we should still report the error.
            handleModelError("Failed to upsert user profile", error);
        }

        if (!data) {
            handleModelError("Failed to upsert user profile: No data returned", new Error("No data returned from upsert"));
        }

        this.id = authUser.id;

        return { data, error: null }; // Return null for error as we handle it
    }

    // Get user by ID
    static async getById(id: string): Promise<User> {
        if (!User.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient()
        const { data, error } = await supa.from("users").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch user", error);
        }
        
        if (!data) {
            handleModelError(`User with id ${id} not found`, new Error("User not found"));
        }
        
        const user = new User(data.firstName, data.lastName, data.role, data.businessId);
        user.id = data.id; // Set the actual database ID
        return user;
    }

    // Get users by business
    static async getByBusiness(businessId: string): Promise<User[]> {
        if (!User.isValidUUID(businessId)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient()
        const { data, error } = await supa.from("users").select("*").eq("businessId", businessId);
        
        if (error) {
            handleModelError("Failed to fetch users by business", error);
        }
        
        return data.map(userData => {
            const user = new User(userData.firstName, userData.lastName, userData.role, userData.businessId);
            user.id = userData.id; // Set the actual database ID
            return user;
        });
    }

    // Get users by role
    static async getByRole(role: UserRole): Promise<User[]> {
        const supa = await createClient()
        const { data, error } = await supa.from("users").select("*").eq("role", role);
        
        if (error) {
            handleModelError("Failed to fetch users by role", error);
        }
        
        return data.map(userData => {
            const user = new User(userData.firstName, userData.lastName, userData.role, userData.businessId);
            user.id = userData.id; // Set the actual database ID
            return user;
        });
    }

    // Get all providers (including admin/providers)
    static async getAllProviders(): Promise<User[]> {
        const supa = await createClient()
        const { data, error } = await supa
            .from("users")
            .select("*")
            .in("role", PROVIDER_ROLES);
        
        if (error) {
            handleModelError("Failed to fetch providers", error);
        }
        
        return data.map(userData => {
            const user = new User(userData.firstName, userData.lastName, userData.role, userData.businessId);
            user.id = userData.id; // Set the actual database ID
            return user;
        });
    }

    // Get the user (owner) of a business by its ID
    static async findUserByBusinessId(businessId: string): Promise<User | null> {
        if (!User.isValidUUID(businessId)) {
            handleModelError("Invalid businessId UUID format", new Error("Invalid UUID"));
        }
        
        try {
            const supa = await createClient();
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

            // Return the first owner/provider found
            const ownerData = users[0];
            const user = new User(ownerData.firstName, ownerData.lastName, ownerData.role, ownerData.businessId);
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
            
            const supa = await createClient();
            
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
            
            const user = new User(userRecord.firstName, userRecord.lastName, userRecord.role, userRecord.businessId);
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
            
            const supa = await createClient();
            
            // Normalize the input WhatsApp number for comparison
            const normalizedInputWhatsappNumber = PhoneNumberUtils.normalize(customerWhatsappNumber);
            console.log(`[User] Normalized input customer WhatsApp number: ${normalizedInputWhatsappNumber}`);
            
            // Query users through auth.users to access user_metadata
            const { data: authUsers, error: authError } = await supa.auth.admin.listUsers();
            
            if (authError) {
                console.error('[User] Error fetching auth users to find customer by WhatsApp number:', authError);
                return null;
            }
            
            if (!authUsers || authUsers.users.length === 0) {
                console.log('[User] No auth users found in database');
                return null;
            }
            
            // Find matching user by normalized WhatsApp number in user_metadata
            const matchedAuthUser = authUsers.users.find(authUser => {
                const userWhatsappNumber = authUser.user_metadata?.whatsappNumber;
                if (!userWhatsappNumber) return false;
                
                const normalizedUserWhatsappNumber = PhoneNumberUtils.normalize(userWhatsappNumber);
                console.log(`[User] Comparing customer's WhatsApp ${normalizedInputWhatsappNumber} with user ${authUser.id} WhatsApp: ${normalizedUserWhatsappNumber}`);
                return normalizedUserWhatsappNumber === normalizedInputWhatsappNumber;
            });
            
            if (!matchedAuthUser) {
                console.log('[User] No customer user found with this WhatsApp number:', normalizedInputWhatsappNumber);
                return null;
            }
            
            console.log(`[User] Found customer user with this WhatsApp number, auth user ID: ${matchedAuthUser.id}`);
            
            // Now get the corresponding user record from the users table
            const { data: userData, error: userError } = await supa
                .from('users')
                .select('*')
                .eq('id', matchedAuthUser.id)
                .single();
                
            if (!userData) {
                console.log('[User] No user record found for auth user:', matchedAuthUser.id);
                return null;
            }
            
            console.log(`[User] Found user record for customer with WhatsApp number, user ID: ${userData.id}`);
            
            const user = new User(userData.firstName, userData.lastName, userData.role, userData.businessId);
            user.id = userData.id; // Set the actual database ID
            return user;
        } catch (error) {
            console.error('[User] Error finding customer user by WhatsApp number:', error);
            return null;
        }
    }

    // Update user
    static async update(id: string, userData: { firstName: string, lastName: string, role: UserRole, businessId: string }): Promise<User> {
        if (!User.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient()
        const updateData = {
            "firstName": userData.firstName,
            "lastName": userData.lastName,
            "role": userData.role,
            "businessId": userData.businessId,
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

        const updatedUser = new User(data.firstName, data.lastName, data.role, data.businessId);
        updatedUser.id = data.id; // Set the actual database ID
        return updatedUser;
    }

    // Delete user
    static async delete(id: string): Promise<void> {
        if (!User.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient()
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
}

