import { productionErrorTracker } from './production-error-tracker';

export class ModelError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "ModelError";
  }
}

export function handleModelError(message: string, error: any): never {
  const errorDetails = error ? {
    message: error.message,
    details: error.details,
    code: error.code,
    hint: error.hint
  } : {};
  
  // Log to console (existing behavior)
  console.error(message, errorDetails);
  
  // Log to error tracking system (new integration)
  // Fire-and-forget to avoid making this function async and breaking existing code
  productionErrorTracker.logDatabaseError(error || new Error(message), {
    additionalContext: {
      modelErrorMessage: message,
      errorDetails,
      stackTrace: new Error().stack
    }
  }).catch(trackingError => {
    // Don't let error tracking failures break the app
    console.error('[ModelError] Failed to log to error tracker:', trackingError);
  });
  
  throw new ModelError(message, error);
}

/**
 * Enhanced error handler that supports additional context for better tracking
 */
export function handleModelErrorWithContext(
  message: string, 
  error: any, 
  context: {
    operation?: string;
    table?: string;
    userId?: string;
    businessId?: string;
    data?: Record<string, any>;
  } = {}
): never {
  const errorDetails = error ? {
    message: error.message,
    details: error.details,
    code: error.code,
    hint: error.hint
  } : {};
  
  // Log to console (existing behavior)
  console.error(message, errorDetails);
  
  // Log to error tracking system with enhanced context
  productionErrorTracker.logDatabaseError(error || new Error(message), {
    userId: context.userId,
    businessId: context.businessId,
    additionalContext: {
      modelErrorMessage: message,
      operation: context.operation,
      table: context.table,
      data: context.data,
      errorDetails,
      stackTrace: new Error().stack
    }
  }).catch(trackingError => {
    console.error('[ModelError] Failed to log to error tracker:', trackingError);
  });
  
  throw new ModelError(message, error);
} 