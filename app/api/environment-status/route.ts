import { NextRequest, NextResponse } from "next/server";
import { 
  getCurrentEnvironment, 
  getEnvironmentInfo, 
  validateEnvironmentConfig 
} from "@/lib/database/supabase/environment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const environment = getCurrentEnvironment();
    const environmentInfo = getEnvironmentInfo();
    const validation = validateEnvironmentConfig();
    
    const status = {
      environment,
      isValid: validation.valid,
      errors: validation.errors,
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
          anonKey: !!process.env.SUPABASE_DEV_ANON_KEY,
          serviceRoleKey: !!process.env.SUPABASE_DEV_SERVICE_ROLE_KEY
        },
        // Production environment
        prod: {
          url: !!process.env.SUPABASE_PROD_URL,
          anonKey: !!process.env.SUPABASE_PROD_ANON_KEY,
          serviceRoleKey: !!process.env.SUPABASE_PROD_SERVICE_ROLE_KEY
        },
        // Legacy/default environment
        default: {
          url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }
    };

    return NextResponse.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error("[Environment Status] Error checking environment:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to check environment status",
      message: error instanceof Error ? error.message : "Unknown error"
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