// Main exports for error handling system
export { ProductionErrorTracker, productionErrorTracker } from './production-error-tracker';
export { ModelError, handleModelError, handleModelErrorWithContext } from './model-error-handler';

// Type exports
export type { ErrorLevel, ErrorLogData } from '@/lib/database/models/error-log';

// Re-export commonly used types for convenience
export interface ErrorContext {
  userId?: string;
  businessId?: string;
  chatSessionId?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
  requestBody?: any;
  queryParams?: any;
  additionalContext?: Record<string, any>;
} 