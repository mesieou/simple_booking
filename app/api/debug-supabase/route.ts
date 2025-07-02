import { NextRequest, NextResponse } from "next/server";
import { getCurrentEnvironment, getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const environment = getCurrentEnvironment();
  
  const diagnostics = {
    environment,
    timestamp: new Date().toISOString(),
    environmentVariables: {
      nodeEnv: process.env.NODE_ENV,
      currentEnvironment: environment,
      prodUrl: process.env.SUPABASE_PROD_URL ? `${process.env.SUPABASE_PROD_URL.substring(0, 40)}...` : 'MISSING',
      prodAnonKey: process.env.SUPABASE_PROD_ANON_KEY ? `${process.env.SUPABASE_PROD_ANON_KEY.substring(0, 30)}...` : 'MISSING',
      prodServiceKey: process.env.SUPABASE_PROD_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_PROD_SERVICE_ROLE_KEY.substring(0, 30)}...` : 'MISSING',
      devUrl: process.env.SUPABASE_DEV_URL ? `${process.env.SUPABASE_DEV_URL.substring(0, 40)}...` : 'MISSING',
      devAnonKey: process.env.SUPABASE_DEV_ANON_KEY ? `${process.env.SUPABASE_DEV_ANON_KEY.substring(0, 30)}...` : 'MISSING',
      devServiceKey: process.env.SUPABASE_DEV_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_DEV_SERVICE_ROLE_KEY.substring(0, 30)}...` : 'MISSING'
    },
    tests: {
      serverClient: { success: false, error: null, details: null },
      serviceRoleClient: { success: false, error: null, details: null },
      businessQuery: { success: false, error: null, found: false, businessName: null },
      allBusinesses: { success: false, error: null, count: 0, samples: [] }
    }
  };

  // Test 1: Server Client Connection
  try {
    console.log(`[Debug Supabase] Testing server client for ${environment}`);
    const serverClient = getEnvironmentServerClient();
    
    const { data: authData, error: authError } = await serverClient.auth.getUser();
    
    diagnostics.tests.serverClient = {
      success: !authError,
      error: authError?.message || null,
      details: {
        hasUser: !!authData?.user,
        clientType: 'server'
      }
    };
  } catch (error) {
    diagnostics.tests.serverClient = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: null
    };
  }

  // Test 2: Service Role Client Connection
  try {
    console.log(`[Debug Supabase] Testing service role client for ${environment}`);
    const serviceClient = getEnvironmentServiceRoleClient();
    
    const { data: authData, error: authError } = await serviceClient.auth.getUser();
    
    diagnostics.tests.serviceRoleClient = {
      success: !authError,
      error: authError?.message || null,
      details: {
        hasUser: !!authData?.user,
        clientType: 'service-role'
      }
    };
  } catch (error) {
    diagnostics.tests.serviceRoleClient = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: null
    };
  }

  // Test 3: Specific Business Query (the one failing)
  try {
    console.log(`[Debug Supabase] Testing specific business query for phone ID: 680108705183414`);
    const client = getEnvironmentServerClient();
    
    const { data, error } = await client
      .from('businesses')
      .select('id, name, whatsappPhoneNumberId')
      .eq('whatsappPhoneNumberId', '680108705183414')
      .single();
    
    diagnostics.tests.businessQuery = {
      success: !error,
      error: error?.message || null,
      found: !!data,
      businessName: data?.name || null
    };
  } catch (error) {
    diagnostics.tests.businessQuery = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      found: false,
      businessName: null
    };
  }

  // Test 4: Get All Businesses (check if table exists and has data)
  try {
    console.log(`[Debug Supabase] Testing businesses table access`);
    const client = getEnvironmentServerClient();
    
    const { data, error } = await client
      .from('businesses')
      .select('id, name, whatsappPhoneNumberId')
      .limit(5);
    
    diagnostics.tests.allBusinesses = {
      success: !error,
      error: error?.message || null,
      count: data?.length || 0,
      samples: data?.map(b => ({
        id: b.id,
        name: b.name,
        phoneNumberId: b.whatsappPhoneNumberId || 'null'
      })) || []
    };
  } catch (error) {
    diagnostics.tests.allBusinesses = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      count: 0,
      samples: []
    };
  }

  // Analysis
  const analysis = {
    environmentDetection: environment === 'production' ? 'CORRECT' : 'WRONG',
    hasValidProdKeys: !!(process.env.SUPABASE_PROD_URL && process.env.SUPABASE_PROD_ANON_KEY && process.env.SUPABASE_PROD_SERVICE_ROLE_KEY),
    connectionStatus: diagnostics.tests.serverClient.success || diagnostics.tests.serviceRoleClient.success ? 'CONNECTED' : 'FAILED',
    businessExists: diagnostics.tests.businessQuery.found,
    tableAccess: diagnostics.tests.allBusinesses.success,
    mainIssue: !diagnostics.tests.serverClient.success ? 'CONNECTION_FAILED' : 
               !diagnostics.tests.businessQuery.found ? 'BUSINESS_NOT_FOUND' : 'OTHER'
  };

  return NextResponse.json({
    success: true,
    diagnostics,
    analysis,
    recommendation: analysis.mainIssue === 'CONNECTION_FAILED' 
      ? 'Fix Supabase connection credentials'
      : analysis.mainIssue === 'BUSINESS_NOT_FOUND'
      ? 'Business with phone ID 680108705183414 does not exist in production database'
      : 'Connection OK - investigate webhook routing logic'
  });
} 