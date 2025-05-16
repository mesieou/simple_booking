declare module 'ts-retry-promise' {
  export function retry<T>(
    fn: () => Promise<T>,
    options?: {
      retries?: number;
      timeout?: number;
      backoff?: 'fixed' | 'exponential';
      backoffBase?: number;
      onRetry?: (error: Error, attempt: number) => void;
    }
  ): Promise<T>;
} 