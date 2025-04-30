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
    pickup: string
    dropoff: string
    // movers?: 1 | 2
}

export type Quote = {
    baseFare: number
    labourRatePerMin: number
    totalEstimate: number
}

/**
 * MVP temporary code that drops hardcoed values for the quote.
 * Swap this logic later for real distance + labour math
 */
export function getQuote(_: QuoteArgs): Quote {
    return {
        baseFare: BASE_FARE_AUD,
        labourRatePerMin: LABOUR_RATE_PER_MIN_AUD,
        totalEstimate: BASE_FARE_AUD, 
    }
}


