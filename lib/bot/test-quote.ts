import { User, UserError } from "../models/user";

export async function testUserCreation(firstName: string, lastName: string): Promise<any> {
    try {
        // Create a new user with customer role and hardcoded business ID
        const user = new User(
            firstName,
            lastName,
            "customer",
            "dd2c2d8b-4b27-4b17-baa4-43f3424c9d96"  // hardcoded business ID
        );

        // Add the user to the database
        const result = await user.add();
        return result;
    } catch (error) {
        console.error("User creation error:", error);
        throw new UserError("Failed to create user", error);
    }
}