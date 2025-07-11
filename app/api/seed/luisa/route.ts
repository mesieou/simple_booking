import { NextRequest, NextResponse } from 'next/server';
import { createLuisaTestBusiness } from '@/lib/database/seed/create-luisa-test-business';
import { getServiceRoleClient, getProdServiceRoleClient } from '@/lib/database/supabase/service-role';
import { cleanupLuisaBusinessData } from '@/scripts/cleanup-luisa-business';
import type { BusinessData } from '@/lib/database/models/business';

// Environment-specific business configurations
const DEV_BUSINESS_CONFIG: Partial<BusinessData> = {
  name: 'Beauty Asiul (DEV)',
  email: 'luisa.dev@beautyasiul.com',
  phone: '+61452490450', // Luisa's phone for dev
  whatsappNumber: '+15551890570', // Luisa's WhatsApp for dev  
  whatsappPhoneNumberId: '684078768113901', // Dev WhatsApp Business API ID
  businessAddress: 'Apt 111,9 Dryburgh st, West Melbourne, VIC 3003 (DEV)',
  stripeConnectAccountId: 'acct_1RdjJT00GaxmqnjE', // Dev Stripe account
  stripeAccountStatus: 'active',
  preferredPaymentMethod: 'cash'
};

const PROD_BUSINESS_CONFIG: Partial<BusinessData> = {
  name: 'Beauty Asiul',
  email: 'luisa.bernal7826@gmail.com', // Real email for production
  phone: '+61411851098', // Real phone for production  
  whatsappNumber: '+61411851098', // Real WhatsApp for production
  whatsappPhoneNumberId: '680108705183414', // Prod WhatsApp Business API ID (different from dev)
  businessAddress: 'Apt 111, 9 Dryburgh st, West Melbourne, VIC 3003',
  stripeConnectAccountId: 'acct_1RjVao00G2f8Rh4l', // Prod Stripe account
  stripeAccountStatus: 'active', 
  preferredPaymentMethod: 'cash' // Prefer card payments in production
};

function getEnvironmentConfig() {
  // Detect environment based on Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isProd = supabaseUrl.includes('itjtaeggupasvrepfkcw');
  
  return {
    isProd,
    environment: isProd ? 'PRODUCTION' : 'DEVELOPMENT',
    config: isProd ? PROD_BUSINESS_CONFIG : DEV_BUSINESS_CONFIG,
    supabaseClient: isProd ? getProdServiceRoleClient() : getServiceRoleClient()
  };
}

export async function POST(req: NextRequest) {
  try {
    const { isProd, environment, config, supabaseClient } = getEnvironmentConfig();
    
    console.log(`💄 Starting Luisa business seed for ${environment}...`);
    
    // Clean up old business data in dev environment only
    if (!isProd) {
      console.log('🧹 Cleaning up old Luisa business data in DEV environment...');
      await cleanupLuisaBusinessData();
      console.log('✅ Old business data cleaned up successfully');
    }
    
    console.log(`📱 Using phone: ${config.phone}`);
    console.log(`📱 Using WhatsApp: ${config.whatsappNumber}`);
    console.log(`📞 Using Phone Number ID: ${config.whatsappPhoneNumberId}`);
    
    const result = await createLuisaTestBusiness(supabaseClient, config);
    
    return NextResponse.json({
      success: true,
      message: `✅ Luisa business seed completed successfully for ${environment}!`,
      environment: {
        type: environment,
        isProd: isProd,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      },
      data: {
        businessId: result.businessId,
        ownerProviderId: result.ownerProviderId,
        serviceCount: result.serviceIds.length,
        calendarSettingsId: result.calendarSettingsId,
        documentCount: result.documentIds.length
      },
      businessConfig: {
        name: config.name,
        phone: config.phone,
        whatsappNumber: config.whatsappNumber,
        whatsappPhoneNumberId: config.whatsappPhoneNumberId,
        email: config.email
      },
      instructions: {
        whatsappNumber: config.whatsappNumber,
        testMessage: `Try asking about beauty services to test fixed pricing quotes! (${environment})`,
        environment: `This business was created for ${environment}`
      }
    });
    
  } catch (error) {
    console.error('❌ Luisa seed failed:', error);
    
    const { environment } = getEnvironmentConfig();
    
    return NextResponse.json({
      success: false,
      environment: environment,
      error: (error as Error).message,
      fullError: error
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { isProd, environment, config } = getEnvironmentConfig();
  
  return NextResponse.json({
    message: `Use POST to run Luisa business seed for ${environment}`,
    environment: {
      type: environment,
      isProd: isProd,
      detected: 'Based on NEXT_PUBLIC_SUPABASE_URL'
    },
    businessConfig: {
      name: config.name,
      phone: config.phone,
      whatsappNumber: config.whatsappNumber,
      whatsappPhoneNumberId: config.whatsappPhoneNumberId,
      businessAddress: config.businessAddress
    },
    warning: `💄 This will create ${config.name} business for ${environment.toLowerCase()} testing`,
    whatsappNumber: config.whatsappNumber
  });
} 