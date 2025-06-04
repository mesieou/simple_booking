import { createClient } from "../supabase/server"
import { Business } from "./business";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

export type UserRole = "admin" | "provider" | "customer" | "admin/provider";

// Provider roles that can have availability
export const PROVIDER_ROLES: UserRole[] = ["provider", "admin/provider"];

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
        const supa = await createClient();

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
            handleModelError("Failed to create auth user", authError);
        }

        if (!authData.user) {
            handleModelError("No user data returned from auth creation", new Error("No auth user data"));
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
            handleModelError("Failed to create user", error);
        }

        if (!data) {
            // If no data returned, clean up the auth user
            await supa.auth.admin.deleteUser(authData.user.id);
            handleModelError("Failed to create user: No data returned", new Error("No data returned from insert"));
        }

        // Update the user's ID to match the auth user's ID
        this.id = authData.user.id;

        return {data, error};
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
        
        return data.map(userData => new User(userData.firstName, userData.lastName, userData.role, userData.businessId));
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
        
        return data.map(userData => new User(userData.firstName, userData.lastName, userData.role, userData.businessId));
    }

    // Update user
    static async update(id: string, userData: { firstName: string, lastName: string, role: UserRole, businessId: string }): Promise<User> {
        if (!User.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient()
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
            handleModelError("Failed to update user", error);
        }

        if (!data) {
            handleModelError("Failed to update user: No data returned", new Error("No data returned from update"));
        }

        return new User(data.firstName, data.lastName, data.role, data.businessId);
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

