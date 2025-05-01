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


/**
 * get_slots
 * Called after user provides a date
 * The LLM passes {"date":"2025-05-15"} and expects slot list back.
 */

export const getSlotsSchema = {
    name: "get_slots",
    description: "Return 4 default time slots for a given moving date",
    parameters: {
        type: "object",
        properties: {
            date: {type:"string", description: "Move date, eg 2025-04-15"},
        },
        required:["date"],
    }
} as const;

/**
 * book_slot
 * called after user choses a slot
 * this is a hardcoded confirmation for now
 */

export const bookSlotSchema = {
    name: "book_slot",
    description: "Finalize the booking for the chose slot",
    parameters: {
        type: "object",
        properties: {
            slotId: {type:"string"},
            date: {typr:"string"},
            pickup: {typr:"string"},
            dropoff: {typr:"string"},
        },
        required: ["slotId", "date", " pickup", "dropoff"],
    },
} as const;


// then export it with the others
export const toolSchemas = [
    getQuoteSchema,
    getSlotsSchema,
    bookSlotSchema      
  ];