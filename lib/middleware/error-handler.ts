import { NextRequest, NextResponse } from 'next/server';
import { productionErrorTracker } from '@/lib/general-helpers/error-handling/production-error-tracker';

export interface ApiError extends Error {
  status?: number;
  code?: string;
  context?: Record<string, any>;
}

/**
 * Global error handler for API routes
 * Wrap your API route handlers with this to automatically catch and log errors
 */
export const withErrorHandler = (
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) => {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error('[API Error]:', error);
      
      // Create proper Error instance and determine if it's ApiError  
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      const isApiError = errorInstance.hasOwnProperty('status') && errorInstance.hasOwnProperty('context');
      const apiError = isApiError ? errorInstance as ApiError : null;

      // Log the error using our error tracking system
      await productionErrorTracker.logApiError(errorInstance, req, {
        additionalContext: {
          route: req.url,
          timestamp: new Date().toISOString(),
          ...(apiError?.context || {})
        }
      });

      // Determine response status
      const status = apiError?.status || 500;
      
      // Prepare error response
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse: any = {
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      };

      // Add more details in development
      if (isDevelopment) {
        errorResponse.details = error instanceof Error ? error.message : String(error);
        if (error instanceof Error && error.stack) {
          errorResponse.stack = error.stack;
        }
      }

      return NextResponse.json(errorResponse, { status });
    }
  };
};

/**
 * Helper to create API errors with specific status codes
 */
export const createApiError = (
  message: string,
  status: number = 500,
  code?: string,
  context?: Record<string, any>
): ApiError => {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  error.context = context;
  return error;
};

/**
 * Common API error types
 */
export const ApiErrorTypes = {
  BadRequest: (message: string, context?: Record<string, any>) => 
    createApiError(message, 400, 'BAD_REQUEST', context),
  
  Unauthorized: (message: string = 'Unauthorized', context?: Record<string, any>) => 
    createApiError(message, 401, 'UNAUTHORIZED', context),
  
  Forbidden: (message: string = 'Forbidden', context?: Record<string, any>) => 
    createApiError(message, 403, 'FORBIDDEN', context),
  
  NotFound: (message: string = 'Not found', context?: Record<string, any>) => 
    createApiError(message, 404, 'NOT_FOUND', context),
  
  ValidationError: (message: string, context?: Record<string, any>) => 
    createApiError(message, 422, 'VALIDATION_ERROR', context),
  
  InternalError: (message: string = 'Internal server error', context?: Record<string, any>) => 
    createApiError(message, 500, 'INTERNAL_ERROR', context),
  
  DatabaseError: (message: string, context?: Record<string, any>) => 
    createApiError(message, 500, 'DATABASE_ERROR', context),
  
  ExternalServiceError: (message: string, context?: Record<string, any>) => 
    createApiError(message, 502, 'EXTERNAL_SERVICE_ERROR', context),
};

/**
 * Wrapper for database operations with automatic error logging
 */
export const withDatabaseErrorHandling = async <T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    await productionErrorTracker.logDatabaseError(
      error instanceof Error ? error : new Error(String(error)),
      { additionalContext: context }
    );
    throw error;
  }
};

/**
 * Wrapper for external API calls with automatic error logging
 */
export const withExternalApiErrorHandling = async <T>(
  operation: () => Promise<T>,
  serviceName: string,
  context?: Record<string, any>
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    await productionErrorTracker.logError(
      'error',
      'EXTERNAL_API_ERROR',
      error instanceof Error ? error : new Error(String(error)),
      { 
        additionalContext: { 
          serviceName,
          ...context 
        } 
      }
    );
    throw error;
  }
}; 