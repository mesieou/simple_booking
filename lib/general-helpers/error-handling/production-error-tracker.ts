import { ErrorLog, ErrorLevel, ErrorLogData } from '@/lib/database/models/error-log';
import { ScalableNotificationService } from '@/lib/bot-engine/services/scalable-notification-service';
import { Business } from '@/lib/database/models/business';
import { NextRequest } from 'next/server';

interface ErrorContext {
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

interface AlertConfig {
  emailEnabled: boolean;
  alertThreshold: {
    critical: number; // Send alert immediately for critical errors
    error: number; // Send alert after X errors in timeframe
    timeframeMinutes: number; // Timeframe for error threshold
  };
  recipients: string[]; // Admin email addresses
}

export class ProductionErrorTracker {
  private static instance: ProductionErrorTracker;
  private notificationService: ScalableNotificationService;
  private alertConfig: AlertConfig;
  private errorCounts: Map<string, { count: number; lastReset: Date }> = new Map();

  private constructor() {
    this.notificationService = new ScalableNotificationService();
    this.alertConfig = {
      emailEnabled: process.env.ERROR_ALERTS_ENABLED === 'true',
      alertThreshold: {
        critical: 1, // Immediate alert for critical errors
        error: 5, // Alert after 5 errors in 15 minutes
        timeframeMinutes: 15
      },
      recipients: (process.env.ERROR_ALERT_EMAILS || '').split(',').filter(Boolean)
    };
  }

  static getInstance(): ProductionErrorTracker {
    if (!ProductionErrorTracker.instance) {
      ProductionErrorTracker.instance = new ProductionErrorTracker();
    }
    return ProductionErrorTracker.instance;
  }

  /**
   * Logs an error and sends alerts if necessary
   */
  async logError(
    level: ErrorLevel,
    errorType: string,
    error: Error | string,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'string' ? undefined : error.stack;

      // Create error log entry
      const errorLog = await ErrorLog.create({
        errorLevel: level,
        errorType,
        errorMessage,
        errorStack,
        ...context
      });

      console.error(`[ProductionErrorTracker] ${level.toUpperCase()}: ${errorType} - ${errorMessage}`);

      // Send alerts if enabled
      if (this.alertConfig.emailEnabled && this.shouldSendAlert(level, errorType)) {
        await this.sendErrorAlert(errorLog, context);
      }

      // Update error counts for threshold tracking
      this.updateErrorCounts(level, errorType);

    } catch (trackingError) {
      // Don't let error tracking break the application
      console.error('[ProductionErrorTracker] Failed to log error:', trackingError);
    }
  }

  /**
   * Convenience method to log API errors
   */
  async logApiError(
    error: Error | string,
    request: NextRequest,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    const url = request.url;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = this.getClientIP(request);

    // Try to parse request body safely
    let requestBody: any;
    try {
      const body = await request.clone().text();
      requestBody = body ? JSON.parse(body) : undefined;
    } catch {
      // Ignore parse errors
    }

    // Parse query params
    const urlObj = new URL(url);
    const queryParams = Object.fromEntries(urlObj.searchParams.entries());

    await this.logError('error', 'API_ERROR', error, {
      ...context,
      url,
      method,
      userAgent,
      ipAddress,
      requestBody,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
    });
  }

  /**
   * Convenience method to log critical errors
   */
  async logCriticalError(
    errorType: string,
    error: Error | string,
    context: ErrorContext = {}
  ): Promise<void> {
    await this.logError('critical', errorType, error, context);
  }

  /**
   * Convenience method to log database errors
   */
  async logDatabaseError(
    error: Error | string,
    context: ErrorContext = {}
  ): Promise<void> {
    await this.logError('error', 'DATABASE_ERROR', error, context);
  }

  /**
   * Convenience method to log bot errors
   */
  async logBotError(
    error: Error | string,
    context: ErrorContext = {}
  ): Promise<void> {
    await this.logError('error', 'BOT_ERROR', error, context);
  }

  /**
   * Convenience method to log payment errors
   */
  async logPaymentError(
    error: Error | string,
    context: ErrorContext = {}
  ): Promise<void> {
    await this.logError('critical', 'PAYMENT_ERROR', error, context);
  }

  /**
   * Get error statistics
   */
  async getStats(businessId?: string) {
    return await ErrorLog.getStats(businessId);
  }

  /**
   * Get recent errors
   */
  async getRecentErrors(options: {
    limit?: number;
    offset?: number;
    level?: ErrorLevel;
    resolved?: boolean;
    businessId?: string;
  } = {}) {
    return await ErrorLog.getRecent(options);
  }

  /**
   * Determines if an alert should be sent based on error level and frequency
   */
  private shouldSendAlert(level: ErrorLevel, errorType: string): boolean {
    if (!this.alertConfig.recipients.length) {
      return false;
    }

    // Always alert for critical errors
    if (level === 'critical') {
      return true;
    }

    // Check error frequency for other levels
    const key = `${level}_${errorType}`;
    const errorCount = this.errorCounts.get(key);
    
    if (!errorCount) {
      return false;
    }

    // Check if we've exceeded the threshold
    return errorCount.count >= this.alertConfig.alertThreshold.error;
  }

  /**
   * Updates error counts for threshold tracking
   */
  private updateErrorCounts(level: ErrorLevel, errorType: string): void {
    const key = `${level}_${errorType}`;
    const now = new Date();
    const existing = this.errorCounts.get(key);

    if (!existing) {
      this.errorCounts.set(key, { count: 1, lastReset: now });
      return;
    }

    // Reset count if timeframe has passed
    const timeframeMsMs = this.alertConfig.alertThreshold.timeframeMinutes * 60 * 1000;
    if (now.getTime() - existing.lastReset.getTime() > timeframeMsMs) {
      this.errorCounts.set(key, { count: 1, lastReset: now });
    } else {
      existing.count++;
    }
  }

  /**
   * Sends error alert email
   */
  private async sendErrorAlert(errorLog: ErrorLog, context: ErrorContext): Promise<void> {
    try {
      // Get business name if available
      let businessName = 'Unknown Business';
      if (context.businessId) {
        try {
          const business = await Business.getById(context.businessId);
          businessName = business?.name || businessName;
        } catch {
          // Ignore business lookup errors
        }
      }

      const subject = `🚨 ${errorLog.errorLevel.toUpperCase()} Error Alert - ${errorLog.errorType}`;
      
      const content = {
        title: subject,
        message: this.formatErrorAlertMessage(errorLog, businessName),
        data: {
          errorId: errorLog.id,
          errorLevel: errorLog.errorLevel,
          errorType: errorLog.errorType,
          errorMessage: errorLog.errorMessage,
          businessName,
          timestamp: errorLog.createdAt,
          url: errorLog.url || 'N/A',
          method: errorLog.method || 'N/A'
        }
      };

      // Send to all configured recipients
      for (const email of this.alertConfig.recipients) {
        await this.notificationService.sendNotification({
          type: 'escalation', // Reuse escalation type for error alerts
          businessId: context.businessId || 'system',
          content,
          recipients: [{
            userId: 'system',
            phoneNumber: '',
            email,
            name: 'Admin',
            role: 'admin',
            isBusinessAdmin: true,
            isSuperAdmin: true,
            preferredChannel: 'email'
          }],
          preferredProviders: ['email']
        });
      }

      console.log(`[ProductionErrorTracker] Alert sent for ${errorLog.errorLevel} error: ${errorLog.errorType}`);

    } catch (alertError) {
      console.error('[ProductionErrorTracker] Failed to send error alert:', alertError);
    }
  }

  /**
   * Formats error alert message
   */
  private formatErrorAlertMessage(errorLog: ErrorLog, businessName: string): string {
    return `
A ${errorLog.errorLevel} error has occurred in your application:

**Error Details:**
- Type: ${errorLog.errorType}
- Message: ${errorLog.errorMessage}
- Time: ${new Date(errorLog.createdAt).toLocaleString()}
- Business: ${businessName}
- URL: ${errorLog.url || 'N/A'}
- Method: ${errorLog.method || 'N/A'}

**Error ID:** ${errorLog.id}

Please check the error dashboard for more details and to mark this error as resolved.
    `.trim();
  }

  /**
   * Extracts client IP from request
   */
  private getClientIP(request: NextRequest): string | undefined {
    // Check various headers for the real IP
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const xRealIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }
    
    if (xRealIp) {
      return xRealIp;
    }
    
    if (cfConnectingIp) {
      return cfConnectingIp;
    }
    
    return undefined;
  }
}

// Export singleton instance with descriptive name
export const productionErrorTracker = ProductionErrorTracker.getInstance(); 