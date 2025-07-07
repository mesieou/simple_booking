export interface ProductionConfig {
  // Redis Configuration
  redis: {
    url: string;
    maxRetries: number;
    retryDelayOnFailover: number;
    maxRetriesPerRequest: number;
  };

  // Session Management
  session: {
    ttlHours: number;
    maxCacheSize: number;
    cleanupIntervalMinutes: number;
  };

  // Message Processing
  messageProcessor: {
    maxRetries: number;
    timeoutMs: number;
    concurrentLimit: number;
  };

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };

  // Database
  database: {
    connectionPoolSize: number;
    queryTimeout: number;
    retryAttempts: number;
  };

  // Monitoring
  monitoring: {
    enabled: boolean;
    metricsPort: number;
    healthCheckPath: string;
  };

  // WhatsApp
  whatsapp: {
    webhookTimeout: number;
    maxMessageSize: number;
    rateLimitPerSecond: number;
  };
}

const config: ProductionConfig = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetries: 3,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },

  session: {
    ttlHours: 2,
    maxCacheSize: process.env.NODE_ENV === 'production' ? 10000 : 1000,
    cleanupIntervalMinutes: 5,
  },

  messageProcessor: {
    maxRetries: 3,
    timeoutMs: 30000,
    concurrentLimit: process.env.NODE_ENV === 'production' ? 100 : 10,
  },

  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: process.env.NODE_ENV === 'production' ? 1000 : 100,
    skipSuccessfulRequests: false,
  },

  database: {
    connectionPoolSize: process.env.NODE_ENV === 'production' ? 20 : 5,
    queryTimeout: 10000,
    retryAttempts: 3,
  },

  monitoring: {
    enabled: process.env.NODE_ENV === 'production',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
    healthCheckPath: '/health',
  },

  whatsapp: {
    webhookTimeout: 15000,
    maxMessageSize: 64 * 1024, // 64KB
    rateLimitPerSecond: 50,
  },
};

export default config;

// Environment validation
export function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'WHATSAPP_VERIFY_TOKEN',
    'OPENAI_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

// Health check function
export async function healthCheck(): Promise<{ status: string; checks: Record<string, boolean> }> {
  const checks: Record<string, boolean> = {};

  // Check database
  try {
    // Add your database health check here
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Redis
  try {
    const { getOrCreateChatContext } = await import('@/lib/bot-engine/session/session-manager');
    // Add basic session manager check
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  // Check external services
  checks.openai = !!process.env.OPENAI_API_KEY;
  checks.whatsapp = !!process.env.WHATSAPP_VERIFY_TOKEN;

  const allHealthy = Object.values(checks).every(Boolean);

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
  };
} 