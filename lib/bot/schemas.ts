// lib/bot/schemas.ts
/**
 * JSON Schemas that describe the arguments OpenAI can send back
 * when it wants to call one of our functions.
 */

export const getQuoteSchema = {
    name: "getQuote",
    description: "Return a moving quote given pickup and dropoff addresses",
    parameters: {
        type: "object",
        properties: {
            pickup: { type: "string", description: "Full pickup address" },
            dropoff: { type: "string", description: "Full dropoff address" },
            // movers: { type: "integer", description: "Number of movers (1 or 2)", enum: [1, 2] },
        },
        required: ["pickup", "dropoff"],
    }
} as const;

export const bookSlotSchema = { 
    name: "bookSlot",
    description: "Lock an avalable time slot for the momve",
    parameters: {
        type: "object",
        properties: {
            slotId: { type: "string", description: "The slot ID to book" },
            pickup: { type: "string", description: "Pickup address" },
            dropoff: { type: "string", description: "Dropoff address" },
            customerName: { type: "string", description: "Customer full name" },
            email: { type: "string", description: "Customer email" },
            phone: { type: "string", description: "Customer phone number" },
            // Add any other properties you need for the booking
            // Datetime, number of movers, etc.
        },
        required: ["slotId", "pickup", "dropoff", "customerName", "email", "phone"]
    }
} as const;