// lib/bot/helpers/quote.ts

/*
=== Quote Helper ===
This module provides a function to generate a quote for a given booking request.
The quote is calculated based on:
1. Base fare (travel to pickup + travel from dropoff)
   - Dynamic calculation based on driver's travel distances
   - Minimum fare ensures profitability for short trips
2. Travel cost per kilometer (pickup to dropoff)
3. Labor cost per minute
*/

// Pricing constants
const COST_PER_KM = 2.50;       // Cost per kilometer for the actual move
const LABOR_PER_MIN = 2.00;     // Cost per minute per worker
const MIN_BASE_FARE = 40.00;    // Minimum base fare for very short distances
const MIN_DISTANCE_FARE = 1.50; // Minimum fare per km for base fare calculation

export type QuoteArgs = {
    pickup: string;
    dropoff: string;
    distance: number;           // in kilometers
    workers: number;            // number of workers
    duration: number;           // in minutes
    toPickupDistance: number;   // distance from driver's location to pickup
    fromDropoffDistance: number;// distance from dropoff to driver's location
}

export type Quote = {
    baseFare: number;           // Cost for travel to pickup and from dropoff
    travelCost: number;         // Cost based on distance
    laborCost: number;          // Cost based on workers and time
    totalCost: number;          // Total cost of the move
    breakdown: {
        toPickupCost: number;   // Cost to travel to pickup
        fromDropoffCost: number;// Cost to travel from dropoff
        baseFareDetails: {
            minFare: number;    // Minimum fare applied
            distanceBased: number; // Fare based on distances
            finalBaseFare: number; // Final base fare used
        }
    }
}

/**
 * Calculate quote based on distance, number of workers, and duration
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
    // Calculate base fare components
    const toPickupCost = toPickupDistance * MIN_DISTANCE_FARE;
    const fromDropoffCost = fromDropoffDistance * MIN_DISTANCE_FARE;
    const distanceBasedFare = toPickupCost + fromDropoffCost;
    
    // Base fare is the higher of:
    // 1. Minimum base fare (for very short trips)
    // 2. Distance-based fare (for longer trips)
    const baseFare = Math.max(MIN_BASE_FARE, distanceBasedFare);
    
    // Calculate travel cost for the actual move
    const travelCost = distance * COST_PER_KM;
    
    // Calculate labor cost
    const laborCost = workers * duration * LABOR_PER_MIN;
    
    // Calculate total cost
    const totalCost = baseFare + travelCost + laborCost;

    return {
        baseFare: Number(baseFare.toFixed(2)),
        travelCost: Number(travelCost.toFixed(2)),
        laborCost: Number(laborCost.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        breakdown: {
            toPickupCost: Number(toPickupCost.toFixed(2)),
            fromDropoffCost: Number(fromDropoffCost.toFixed(2)),
            baseFareDetails: {
                minFare: MIN_BASE_FARE,
                distanceBased: Number(distanceBasedFare.toFixed(2)),
                finalBaseFare: Number(baseFare.toFixed(2))
            }
        }
    };
}


