import { createClient } from "@/lib/supabase/server"
import { Business } from "./business";
import { v4 as uuidv4 } from 'uuid';

export type UserRole = "admin" | "provider" | "customer" | "admin/provider";

// Provider roles that can have availability
export const PROVIDER_ROLES: UserRole[] = ["provider", "admin/provider"];

export class UserError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'UserError';
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
    async add() {
        const supa = createClient()

        // First create the auth user
        const { data: authData, error: authError } = await supa.auth.admin.createUser({
            email: `${this.firstName.toLowerCase()}.${this.lastName.toLowerCase()}@example.com`,
            password: 'password123', // You might want to generate a random password
            email_confirm: true,
            user_metadata: {
                firstName: this.firstName,
                lastName: this.lastName,
                role: this.role
            }
        });

        if (authError) {
            throw new UserError("Failed to create auth user", authError);
        }

        if (!authData.user) {
            throw new UserError("No user data returned from auth creation");
        }

        // Wait a bit to ensure the auth user is fully created
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Then create the user record
        const user = {
            "id": authData.user.id,
            "firstName": this.firstName,
            "lastName": this.lastName,
            "role": this.role,
            "businessId": this.businessId,
            "createdAt": new Date().toISOString()
        }

        const { data, error } = await supa.from("users").insert(user).select().single();

        if(error) {
            // If user record creation fails, we should clean up the auth user
            await supa.auth.admin.deleteUser(authData.user.id);
            throw new UserError("Failed to create user", error);
        }

        if (!data) {
            // If no data returned, clean up the auth user
            await supa.auth.admin.deleteUser(authData.user.id);
            throw new UserError("Failed to create user: No data returned");
        }

        // Update the user's ID to match the auth user's ID
        this.id = authData.user.id;

        return {data, error};
    }

    // Get user by ID
    static async getById(id: string): Promise<User> {
        if (!User.isValidUUID(id)) {
            throw new UserError("Invalid UUID format");
        }

        const supa = createClient()
        const { data, error } = await supa.from("users").select("*").eq("id", id).single();
        
        if (error) {
            throw new UserError("Failed to fetch user", error);
        }
        
        if (!data) {
            throw new UserError(`User with id ${id} not found`);
        }
        
        return new User(data.firstName, data.lastName, data.role, data.businessId);
    }

    // Get users by business
    static async getByBusiness(businessId: string): Promise<User[]> {
        if (!User.isValidUUID(businessId)) {
            throw new UserError("Invalid UUID format");
        }

        const supa = createClient()
        const { data, error } = await supa.from("users").select("*").eq("businessId", businessId);
        
        if (error) {
            throw new UserError("Failed to fetch users by business", error);
        }
        
        return data.map(userData => new User(userData.firstName, userData.lastName, userData.role, userData.businessId));
    }

    // Get users by role
    static async getByRole(role: UserRole): Promise<User[]> {
        const supa = createClient()
        const { data, error } = await supa.from("users").select("*").eq("role", role);
        
        if (error) {
            throw new UserError("Failed to fetch users by role", error);
        }
        
        return data.map(userData => new User(userData.firstName, userData.lastName, userData.role, userData.businessId));
    }

    // Get all providers (including admin/providers)
    static async getAllProviders(): Promise<User[]> {
        const supa = createClient()
        const { data, error } = await supa
            .from("users")
            .select("*")
            .in("role", PROVIDER_ROLES);
        
        if (error) {
            throw new UserError("Failed to fetch providers", error);
        }
        
        return data.map(userData => new User(userData.firstName, userData.lastName, userData.role, userData.businessId));
    }

    // Update user
    static async update(id: string, userData: { firstName: string, lastName: string, role: UserRole, businessId: string }): Promise<User> {
        if (!User.isValidUUID(id)) {
            throw new UserError("Invalid UUID format");
        }

        const supa = createClient()
        const user = {
            "firstName": userData.firstName,
            "lastName": userData.lastName,
            "role": userData.role,
            "businessId": userData.businessId,
        }
        
        const { data, error } = await supa
            .from("users")
            .update(user)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw new UserError("Failed to update user", error);
        }

        if (!data) {
            throw new UserError("Failed to update user: No data returned");
        }

        return new User(data.firstName, data.lastName, data.role, data.businessId);
    }

    // Delete user
    static async delete(id: string): Promise<void> {
        if (!User.isValidUUID(id)) {
            throw new UserError("Invalid UUID format");
        }

        const supa = createClient()
        const { error } = await supa.from("users").delete().eq("id", id);

        if (error) {
            throw new UserError("Failed to delete user", error);
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // Getters for the user data
    get createdAt(): string | undefined { return undefined; }
    get updatedAt(): string | undefined { return undefined; }
}

