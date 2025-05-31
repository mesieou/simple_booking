// lib/bot/schemas.ts
/**
 * JSON Schemas that describe the arguments OpenAI can send back
 * when it wants to call one of our functions.
 */

export const createUserSchema = {
    name: "createUser",
    description: "Create a new customer user with the provided name.",
    parameters: {
        type: "object",
        properties: {
            firstName: { type: "string", description: "Customer's first name" },
            lastName: { type: "string", description: "Customer's last name" }
        },
        required: ["firstName", "lastName"]
    }
} as const;

// Export all schemas
export const toolSchemas = [createUserSchema];