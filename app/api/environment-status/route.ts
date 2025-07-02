import { NextRequest, NextResponse } from "next/server";
import { 
  getCurrentEnvironment, 
  getEnvironmentInfo, 
  validateEnvironmentConfig 
} from "@/lib/database/supabase/environment";
import { getEnvironmentServerClient } from "@/lib/database/supabase/environment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const environment = getCurrentEnvironment();
    const environmentInfo = getEnvironmentInfo();
    const validation = validateEnvironmentConfig();
    
    // Test Supabase connection
    let supabaseTest = {
      success: false,
      error: null as string | null,
      connectionUrl: null as string | null,
      phoneNumberIdQuery: {
        success: false,
        error: null as string | null,
        found: false,
        businessName: null as string | null
      }
    };

    try {
      console.log(`[Environment Status] Testing Supabase connection for ${environment} environment`);
      const supabase = getEnvironmentServerClient();
      
      // Test the exact query that's failing in webhook
      const phoneNumberIdTest = await supabase
        .from('businesses')
        .select('*')
        .eq('whatsappPhoneNumberId', '680108705183414')
        .single();

      supabaseTest = {
        success: !phoneNumberIdTest.error,
        error: phoneNumberIdTest.error?.message || null,
        connectionUrl: environment === 'production' 
          ? process.env.SUPABASE_PROD_URL?.substring(0, 30) + "..." 
          : process.env.SUPABASE_DEV_URL?.substring(0, 30) + "...",
        phoneNumberIdQuery: {
          success: !phoneNumberIdTest.error,
          error: phoneNumberIdTest.error?.message || null,
          found: !!phoneNumberIdTest.data,
          businessName: phoneNumberIdTest.data?.name || null
        }
      };
    } catch (supabaseError) {
      supabaseTest.error = supabaseError instanceof Error ? supabaseError.message : 'Unknown Supabase error';
    }
    
    const status = {
      environment,
      isValid: validation.valid,
      errors: validation.errors,
      supabaseTest,
      configuration: {
        nodeEnv: environmentInfo.nodeEnv,
        hasDevConfig: environmentInfo.hasDevConfig,
        hasProdConfig: environmentInfo.hasProdConfig,
        timestamp: environmentInfo.timestamp
      },
      services: {
        webhook: {
          enabled: process.env.USE_WABA_WEBHOOK === "true",
          verifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
          appSecret: !!process.env.WHATSAPP_APP_SECRET
        },
        stripe: {
          configured: !!process.env.STRIPE_SECRET_KEY,
          webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
        },
        whatsapp: {
          accessToken: !!process.env.WHATSAPP_PERMANENT_TOKEN,
          phoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID
        }
      },
      environmentVariables: {
        // Development environment
        dev: {
          url: !!process.env.SUPABASE_DEV_URL,
          urlPartial: process.env.SUPABASE_DEV_URL?.substring(0, 30) + "...",
          anonKey: !!process.env.SUPABASE_DEV_ANON_KEY,
          anonKeyPartial: process.env.SUPABASE_DEV_ANON_KEY?.substring(0, 20) + "...",
          serviceRoleKey: !!process.env.SUPABASE_DEV_SERVICE_ROLE_KEY,
          serviceRoleKeyPartial: process.env.SUPABASE_DEV_SERVICE_ROLE_KEY?.substring(0, 20) + "..."
        },
        // Production environment
        prod: {
          url: !!process.env.SUPABASE_PROD_URL,
          urlPartial: process.env.SUPABASE_PROD_URL?.substring(0, 30) + "...",
          anonKey: !!process.env.SUPABASE_PROD_ANON_KEY,
          anonKeyPartial: process.env.SUPABASE_PROD_ANON_KEY?.substring(0, 20) + "...",
          serviceRoleKey: !!process.env.SUPABASE_PROD_SERVICE_ROLE_KEY,
          serviceRoleKeyPartial: process.env.SUPABASE_PROD_SERVICE_ROLE_KEY?.substring(0, 20) + "..."
        },
        // Legacy/default environment
        default: {
          url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          urlPartial: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
          anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          anonKeyPartial: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + "...",
          serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          serviceRoleKeyPartial: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + "..."
        }
      },
      currentlyUsing: {
        environment,
        url: environment === 'production' ? process.env.SUPABASE_PROD_URL?.substring(0, 30) + "..." : process.env.SUPABASE_DEV_URL?.substring(0, 30) + "...",
        anonKey: environment === 'production' ? process.env.SUPABASE_PROD_ANON_KEY?.substring(0, 20) + "..." : process.env.SUPABASE_DEV_ANON_KEY?.substring(0, 20) + "...",
        serviceRoleKey: environment === 'production' ? process.env.SUPABASE_PROD_SERVICE_ROLE_KEY?.substring(0, 20) + "..." : process.env.SUPABASE_DEV_SERVICE_ROLE_KEY?.substring(0, 20) + "..."
      }
    };

    return NextResponse.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('[Environment Status] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: getCurrentEnvironment()
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    message: "Environment Status Endpoint",
    description: "Use GET to check current environment configuration and status",
    endpoints: {
      "GET /api/environment-status": "Check current environment status"
    }
  }, { status: 405 });
} 