import { NextResponse } from 'next/server';
// Correcting import path to be relative for potentially better module resolution
import { createLuisaTestBusinessForProduction, type LuisaTestBusinessSeedResult } from '@/lib/database/seed/create-luisa-test-business';
// Supabase client is not strictly needed here as createLuisaTestBusiness uses models 
// that internally call createClient(), but it's good practice for API routes to manage clients if needed.
// import { createClient } from '@/lib/database/supabase/server';

export async function POST(request: Request) {
  try {
    // const supabase = createClient(); // If you were to pass it to createLuisaTestBusiness
    console.log("[SEED] Starting Luisa's test business seeding process...");
    const result: LuisaTestBusinessSeedResult = await createLuisaTestBusinessForProduction();
    
    console.log("[SEED] Successfully seeded Luisa's test business:", {
      businessId: result.businessId,
      ownerProviderId: result.ownerProviderId,
      serviceCount: result.serviceIds.length,
      calendarSettingsId: result.calendarSettingsId
    });

    return NextResponse.json({
      message: "Luisa's test business seeded successfully",
      data: result
    });

  } catch (error) {
    // Enhanced error logging
    console.error("[SEED ERROR] Detailed error information:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'No message available',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      // If it's a ModelError, log the original error
      originalError: error instanceof Error && 'originalError' in error ? error.originalError : null
    });

    // Check if it's a fetch error (which might indicate Supabase connection issues)
    if (error instanceof Error && error.message.includes('fetch failed')) {
      console.error("[SEED ERROR] Supabase connection issue detected. Please check:");
      console.error("1. SUPABASE_URL environment variable is set correctly");
      console.error("2. SUPABASE_ANON_KEY environment variable is set correctly");
      console.error("3. Network connectivity to Supabase");
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { 
        error: 'Failed to seed Luisa\'s test business', 
        details: errorMessage,
        type: error instanceof Error ? error.name : 'Unknown',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 