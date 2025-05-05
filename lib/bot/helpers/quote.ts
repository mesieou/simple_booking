// lib/bot/helpers/quote.ts

/*
=== Quote Helper ===
This module provides a function to generate a quote for a given booking request.
For the moment the values are going to be hardcoded.

To import this module, use the following syntax:
import { getQuote } from "@/lib/bot/helpers/quote";
*/

const BASE_FARE_AUD = 90; // Flat fee
const LABOUR_RATE_PER_MIN_AUD = 2.62;  // Per mover minute

export type QuoteArgs = {
    pickup: string;
    dropoff: string;
    distance?: number;           // in kilometers
    workers?: number;            // number of workers
    duration?: number;           // in minutes
    toPickupDistance?: number;   // distance from driver's location to pickup
    fromDropoffDistance?: number;// distance from dropoff to driver's location
}

export type Quote = {
    baseFare: number;
    labourRatePerMin: number;
    totalEstimate: number;
}

/**
 * MVP temporary code that drops hardcoed values for the quote.
 * Swap this logic later for real distance + labour math
 */
export function getQuote({ 
    pickup, 
    dropoff,
    distance = 15,              // Default 15km if not provided
    workers = 2,                // Default 2 workers if not provided
    duration = 90,              // Default 90 minutes if not provided
    toPickupDistance = 10,      // Default 10km to pickup
    fromDropoffDistance = 10    // Default 10km from dropoff
}: QuoteArgs): Quote {
    return {
        baseFare: BASE_FARE_AUD,
        labourRatePerMin: LABOUR_RATE_PER_MIN_AUD,
        totalEstimate: BASE_FARE_AUD, 
    }
}


