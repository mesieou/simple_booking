'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * React Error Boundary that catches JavaScript errors anywhere in the child component tree
 * and automatically reports them to our error tracking system
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Report error to our tracking system
    this.reportError(error, errorInfo);
    
    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  private async reportError(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const errorData = {
        errorLevel: 'error' as const,
        errorType: 'CLIENT_SIDE_ERROR',
        errorMessage: error.message,
        errorStack: error.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        additionalContext: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          timestamp: new Date().toISOString(),
          props: this.props,
        }
      };

      // Send to our error tracking API
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (reportingError) {
      console.error('[ErrorBoundary] Failed to report error:', reportingError);
    }
  }

  private resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      // Default error UI
      return <DefaultErrorFallback error={this.state.error!} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ 
  error, 
  resetError 
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
          </div>
          
          <p className="text-red-700 mb-4">
            An unexpected error occurred. Our team has been notified and is working to fix it.
          </p>

          {isDevelopment && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs overflow-auto">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={resetError}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            
            <Button 
              onClick={() => window.location.reload()}
              size="sm"
              variant="default"
            >
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to manually report errors from within components
 */
export const useErrorReporting = () => {
  const reportError = async (
    error: Error | string,
    context?: Record<string, any>
  ) => {
    try {
      const errorData = {
        errorLevel: 'error' as const,
        errorType: 'MANUAL_CLIENT_ERROR',
        errorMessage: typeof error === 'string' ? error : error.message,
        errorStack: typeof error === 'string' ? undefined : error.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        additionalContext: {
          manual: true,
          timestamp: new Date().toISOString(),
          ...context,
        }
      };

      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (reportingError) {
      console.error('[ErrorReporting] Failed to report error:', reportingError);
    }
  };

  return { reportError };
};

/**
 * Global error handler for unhandled promise rejections and JavaScript errors
 */
export const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', async (event) => {
    console.error('[Global] Unhandled promise rejection:', event.reason);
    
    try {
      const errorData = {
        errorLevel: 'error' as const,
        errorType: 'UNHANDLED_PROMISE_REJECTION',
        errorMessage: event.reason?.message || String(event.reason),
        errorStack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        additionalContext: {
          promiseRejection: true,
          timestamp: new Date().toISOString(),
        }
      };

      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (reportingError) {
      console.error('[Global] Failed to report promise rejection:', reportingError);
    }
  });

  // Handle global JavaScript errors
  window.addEventListener('error', async (event) => {
    console.error('[Global] JavaScript error:', event.error);
    
    try {
      const errorData = {
        errorLevel: 'error' as const,
        errorType: 'GLOBAL_JAVASCRIPT_ERROR',
        errorMessage: event.message,
        errorStack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        additionalContext: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          timestamp: new Date().toISOString(),
        }
      };

      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (reportingError) {
      console.error('[Global] Failed to report JavaScript error:', reportingError);
    }
  });
}; 