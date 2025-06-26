import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/supabase/server";

export async function GET(request: NextRequest) {
  try {
    console.log("=== DEBUG AUTH ENDPOINT ===");
    
    // Check environment variables
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log("ENV Check - URL:", hasUrl);
    console.log("ENV Check - Service Key:", hasServiceKey);
    
    if (!hasUrl || !hasServiceKey) {
      return NextResponse.json({
        error: "Missing environment variables",
        hasUrl,
        hasServiceKey,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING"
      }, { status: 500 });
    }
    
    // Test Supabase connection
    const supabase = createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log("Session Error:", sessionError);
    console.log("Session Exists:", !!session);
    
    // Test database connection
    const { data: testData, error: dbError } = await supabase
      .from("businesses")
      .select("id")
      .limit(1);
    
    console.log("DB Error:", dbError);
    console.log("DB Connection:", !!testData);
    
    return NextResponse.json({
      success: true,
      environment: {
        hasUrl: true,
        hasServiceKey: true,
        domain: request.nextUrl.origin
      },
      session: {
        exists: !!session,
        userId: session?.user?.id || null,
        error: sessionError?.message || null
      },
      database: {
        connected: !dbError,
        error: dbError?.message || null
      }
    });
    
  } catch (error) {
    console.error("Debug Auth Error:", error);
    return NextResponse.json({
      error: "Debug endpoint failed",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}