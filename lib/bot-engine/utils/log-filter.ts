/**
 * Log filtering utility to reduce verbosity from legacy logging
 * This intercepts console logs and filters out noisy/repetitive messages
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogFilter {
  pattern: RegExp;
  level: LogLevel[];
  action: 'suppress' | 'throttle' | 'simplify';
  throttleMs?: number;
  replacement?: string;
}

class LogFilterManager {
  private originalConsole: Record<LogLevel, (...args: any[]) => void> = {} as any;
  private throttleCache: Map<string, number> = new Map();
  private isEnabled: boolean = false;

  private filters: LogFilter[] = [
    // Environment logs - suppress most, keep errors
    {
      pattern: /^\[Environment\]/,
      level: ['log', 'info', 'debug'],
      action: 'suppress'
    },
    {
      pattern: /^\[Environment\].*error/i,
      level: ['log', 'info', 'warn', 'error'],
      action: 'simplify',
      replacement: '⚠️ [Environment] Configuration issue detected'
    },

    // User lookup logs - throttle heavily
    {
      pattern: /^\[User\] (Finding|Found|Normalized)/,
      level: ['log', 'info'],
      action: 'throttle',
      throttleMs: 10000 // Only show once per 10 seconds
    },

    // Session logic - keep only important ones
    {
      pattern: /^\[SessionLogic\] (No previous session|Created new session)/,
      level: ['log', 'info'],
      action: 'simplify',
      replacement: '🔄 [Session] New session created'
    },
    {
      pattern: /^\[SessionLogic\]/,
      level: ['log', 'info', 'debug'],
      action: 'suppress'
    },

    // History extractor - suppress DEBUG, keep important ones
    {
      pattern: /^\[HistoryExtractor\] DEBUG/,
      level: ['log', 'info', 'debug'],
      action: 'suppress'
    },
    {
      pattern: /^\[HistoryExtractor\] (No UserContext found|Created new UserContext)/,
      level: ['log', 'info'],
      action: 'simplify',
      replacement: '👤 [User] Context initialized'
    },

    // Session Manager DEBUG - suppress most
    {
      pattern: /^\[SessionManager\] DEBUG/,
      level: ['log', 'info', 'debug'],
      action: 'suppress'
    },

    // State Persister - reduce verbosity significantly
    {
      pattern: /^\[StatePersister\] DEBUG/,
      level: ['log', 'info', 'debug'],
      action: 'suppress'
    },
    {
      pattern: /^\[StatePersister\] (Adding message pair|Successfully updated|Updated ChatSession)/,
      level: ['log', 'info'],
      action: 'throttle',
      throttleMs: 5000,
      replacement: '💾 [State] Session updated'
    },

    // Webhook processing - reduce duplicates
    {
      pattern: /^\[Webhook.*\] Processing message for business/,
      level: ['log', 'info'],
      action: 'throttle',
      throttleMs: 2000
    },
    {
      pattern: /POST \/api\/webhook2 200 in \d+ms/,
      level: ['log', 'info'],
      action: 'suppress'
    },

    // Business lookups - throttle
    {
      pattern: /^\[Business\] (Finding business|Found business)/,
      level: ['log', 'info'],
      action: 'throttle',
      throttleMs: 8000
    },

    // Language detection - keep only changes
    {
      pattern: /^\[WhatsAppHandler\] Language already set/,
      level: ['log', 'info'],
      action: 'suppress'
    },
    {
      pattern: /^\[WhatsAppHandler\] System message detected/,
      level: ['log', 'info'],
      action: 'suppress'
    },

    // Response processor - simplify
    {
      pattern: /^\[Response Processor\] (Using proper localization|Attempting to send)/,
      level: ['log', 'info'],
      action: 'suppress'
    },

    // WhatsApp sender details - suppress most technical details
    {
      pattern: /^\[WhatsappSender\] (Sending payload|Message sent successfully|Creating list)/,
      level: ['log', 'info'],
      action: 'suppress'
    },

    // Goal Manager debug - keep only the important stuff
    {
      pattern: /===== GOAL MANAGER DEBUG =====/,
      level: ['log', 'info'],
      action: 'suppress'
    },
    {
      pattern: /===============================/,
      level: ['log', 'info'],
      action: 'suppress'
    },

    // Quote Summary - keep important journey/flow logs, reduce debug noise
    {
      pattern: /^\[QuoteSummary\] DEBUG/,
      level: ['log', 'info'],
      action: 'suppress'
    },
    {
      pattern: /🚀.*\[QuoteSummary\].*Quote processing completed/,
      level: ['log', 'info'],
      action: 'simplify',
      replacement: '💰 [Quote] Summary generated successfully'
    },
    {
      pattern: /→.*\[QuoteSummary\].*Starting quote calculation/,
      level: ['log', 'info'],
      action: 'simplify',
      replacement: '🧮 [Quote] Calculating pricing and details'
    }
  ];

  enable(): void {
    if (this.isEnabled) return;

    // Store original console methods
    (['log', 'info', 'warn', 'error', 'debug'] as LogLevel[]).forEach(level => {
      this.originalConsole[level] = console[level];
    });

    // Override console methods
    (['log', 'info', 'warn', 'error', 'debug'] as LogLevel[]).forEach(level => {
      console[level] = (...args: any[]) => {
        const message = args.join(' ');
        if (this.shouldLog(message, level)) {
          const processedArgs = this.processMessage(message, level, args);
          this.originalConsole[level](...processedArgs);
        }
      };
    });

    this.isEnabled = true;
    console.log('🔇 Log filtering enabled - reducing verbosity');
  }

  disable(): void {
    if (!this.isEnabled) return;

    // Restore original console methods
    (['log', 'info', 'warn', 'error', 'debug'] as LogLevel[]).forEach(level => {
      console[level] = this.originalConsole[level];
    });

    this.isEnabled = false;
    console.log('🔊 Log filtering disabled - full verbosity restored');
  }

  private shouldLog(message: string, level: LogLevel): boolean {
    for (const filter of this.filters) {
      if (filter.pattern.test(message) && filter.level.includes(level)) {
        switch (filter.action) {
          case 'suppress':
            return false;
          
          case 'throttle':
            return this.checkThrottle(message, filter.throttleMs || 5000);
          
          case 'simplify':
            return true; // Will be processed in processMessage
        }
      }
    }
    return true;
  }

  private processMessage(message: string, level: LogLevel, originalArgs: any[]): any[] {
    for (const filter of this.filters) {
      if (filter.pattern.test(message) && filter.level.includes(level) && filter.action === 'simplify') {
        return [filter.replacement || message];
      }
    }
    return originalArgs;
  }

  private checkThrottle(message: string, throttleMs: number): boolean {
    const key = message.substring(0, 100); // Use first 100 chars as key
    const now = Date.now();
    const lastLogged = this.throttleCache.get(key);

    if (!lastLogged || now - lastLogged > throttleMs) {
      this.throttleCache.set(key, now);
      return true;
    }
    return false;
  }

  // Clean up throttle cache periodically
  private cleanupThrottleCache(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    for (const [key, timestamp] of this.throttleCache.entries()) {
      if (now - timestamp > maxAge) {
        this.throttleCache.delete(key);
      }
    }
  }
}

// Create singleton instance
const logFilter = new LogFilterManager();

// Auto-cleanup every minute
setInterval(() => {
  (logFilter as any).cleanupThrottleCache();
}, 60000);

// Export controls
export const enableLogFiltering = () => logFilter.enable();
export const disableLogFiltering = () => logFilter.disable();

// Auto-enable in production, optional in development
if (process.env.NODE_ENV === 'production') {
  enableLogFiltering();
}

// For development, you can manually enable:
// import { enableLogFiltering } from '@/lib/bot-engine/utils/log-filter';
// enableLogFiltering(); 