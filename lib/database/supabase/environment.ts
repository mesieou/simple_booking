import { SupabaseClient } from '@supabase/supabase-js';
import { 
  createClient, 
  createDevServerClient, 
  createProdServerClient 
} from './server';
import { 
  createClient as createBrowserClient,
  createDevClient,
  createProdClient 
} from './client';
import { 
  getServiceRoleClient, 
  getDevServiceRoleClient, 
  getProdServiceRoleClient 
} from './service-role';

export type Environment = 'development' | 'production';
export type ClientType = 'server' | 'browser' | 'service-role';

/**
 * Determines the current environment based on NODE_ENV and other factors
 */
export function getCurrentEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV;
  
  // In production, always use production environment
  if (nodeEnv === 'production') {
    return 'production';
  }
  
  // For development/test, use development environment
  return 'development';
}

/**
 * Gets the appropriate Supabase client based on environment and client type
 */
export function getEnvironmentClient(
  clientType: ClientType = 'server',
  forceEnvironment?: Environment
): SupabaseClient | ReturnType<typeof createClient> {
  const environment = forceEnvironment || getCurrentEnvironment();
  
  console.log(`[Environment] Using ${environment} environment for ${clientType} client`);
  
  switch (clientType) {
    case 'server':
      return environment === 'production' 
        ? createProdServerClient() 
        : createDevServerClient();
        
    case 'browser':
      return environment === 'production' 
        ? createProdClient() 
        : createDevClient();
        
    case 'service-role':
      return environment === 'production' 
        ? getProdServiceRoleClient() 
        : getDevServiceRoleClient();
        
    default:
      throw new Error(`Unknown client type: ${clientType}`);
  }
}

/**
 * Helper for server components - gets environment-appropriate server client
 */
export function getEnvironmentServerClient(forceEnvironment?: Environment) {
  if (process.env.NODE_ENV === 'test') {
    // During tests we don't have Next.js request context for cookies,
    // so fall back to using the service-role client.
    return getEnvironmentServiceRoleClient(forceEnvironment);
  }
  return getEnvironmentClient('server', forceEnvironment);
}

/**
 * Helper for service role operations - gets environment-appropriate service client
 */
export function getEnvironmentServiceRoleClient(forceEnvironment?: Environment) {
  return getEnvironmentClient('service-role', forceEnvironment);
}

/**
 * Helper for browser components - gets environment-appropriate browser client
 */
export function getEnvironmentBrowserClient(forceEnvironment?: Environment) {
  return getEnvironmentClient('browser', forceEnvironment);
}

/**
 * Get environment info for debugging/logging
 */
export function getEnvironmentInfo() {
  const environment = getCurrentEnvironment();
  return {
    environment,
    nodeEnv: process.env.NODE_ENV,
    hasDevConfig: !!(process.env.SUPABASE_DEV_URL && process.env.SUPABASE_DEV_ANON_KEY),
    hasProdConfig: !!(process.env.SUPABASE_PROD_URL && process.env.SUPABASE_PROD_ANON_KEY),
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const environment = getCurrentEnvironment();
  
  if (environment === 'production') {
    if (!process.env.SUPABASE_PROD_URL) errors.push('Missing SUPABASE_PROD_URL');
    if (!process.env.SUPABASE_PROD_ANON_KEY) errors.push('Missing SUPABASE_PROD_ANON_KEY');
    if (!process.env.SUPABASE_PROD_SERVICE_ROLE_KEY) errors.push('Missing SUPABASE_PROD_SERVICE_ROLE_KEY');
  } else {
    if (!process.env.SUPABASE_DEV_URL) errors.push('Missing SUPABASE_DEV_URL');
    if (!process.env.SUPABASE_DEV_ANON_KEY) errors.push('Missing SUPABASE_DEV_ANON_KEY');
    if (!process.env.SUPABASE_DEV_SERVICE_ROLE_KEY) errors.push('Missing SUPABASE_DEV_SERVICE_ROLE_KEY');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
} 