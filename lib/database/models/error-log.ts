import { getEnvironmentServerClient } from "../supabase/environment";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error-handling/model-error-handler';

export type ErrorLevel = 'error' | 'warn' | 'critical';

export interface ErrorLogData {
  id?: string;
  errorLevel: ErrorLevel;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  url?: string;
  method?: string;
  userId?: string;
  businessId?: string;
  chatSessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  requestBody?: Record<string, any>;
  queryParams?: Record<string, any>;
  environment?: string;
  version?: string;
  additionalContext?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ErrorLogDBSchema {
  id: string;
  errorLevel: ErrorLevel;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  url?: string;
  method?: string;
  userId?: string;
  businessId?: string;
  chatSessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  requestBody?: Record<string, any>;
  queryParams?: Record<string, any>;
  environment?: string;
  version?: string;
  additionalContext?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export class ErrorLog {
  id: string;
  errorLevel: ErrorLevel;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  url?: string;
  method?: string;
  userId?: string;
  businessId?: string;
  chatSessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  requestBody?: Record<string, any>;
  queryParams?: Record<string, any>;
  environment?: string;
  version?: string;
  additionalContext?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;

  private static _tableName = 'errorLogs';

  constructor(data: ErrorLogData) {
    this.id = data.id || uuidv4();
    this.errorLevel = data.errorLevel;
    this.errorType = data.errorType;
    this.errorMessage = data.errorMessage;
    this.errorStack = data.errorStack;
    this.url = data.url;
    this.method = data.method;
    this.userId = data.userId;
    this.businessId = data.businessId;
    this.chatSessionId = data.chatSessionId;
    this.userAgent = data.userAgent;
    this.ipAddress = data.ipAddress;
    this.requestBody = data.requestBody;
    this.queryParams = data.queryParams;
    this.environment = data.environment || 'production';
    this.version = data.version;
    this.additionalContext = data.additionalContext;
    this.resolved = data.resolved || false;
    this.resolvedAt = data.resolvedAt;
    this.resolvedBy = data.resolvedBy;
    this.resolutionNotes = data.resolutionNotes;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Creates a new error log entry
   */
  static async create(errorData: Omit<ErrorLogData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ErrorLog> {
    try {
      const supabase = getEnvironmentServerClient();
      const id = uuidv4();
      
      const dbData: Partial<ErrorLogDBSchema> = {
        id,
        errorLevel: errorData.errorLevel,
        errorType: errorData.errorType,
        errorMessage: errorData.errorMessage,
        errorStack: errorData.errorStack,
        url: errorData.url,
        method: errorData.method,
        userId: errorData.userId,
        businessId: errorData.businessId,
        chatSessionId: errorData.chatSessionId,
        userAgent: errorData.userAgent,
        ipAddress: errorData.ipAddress,
        requestBody: errorData.requestBody,
        queryParams: errorData.queryParams,
        environment: errorData.environment || 'production',
        version: errorData.version,
        additionalContext: errorData.additionalContext,
        resolved: false
      };

      const { data, error } = await supabase
        .from(ErrorLog._tableName)
        .insert(dbData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return ErrorLog._fromDBSchema(data);
    } catch (error) {
      handleModelError('Failed to create error log', error);
    }
  }

  /**
   * Gets recent error logs with pagination
   */
  static async getRecent(options: {
    limit?: number;
    offset?: number;
    level?: ErrorLevel;
    resolved?: boolean;
    businessId?: string;
  } = {}): Promise<{ errors: ErrorLog[], total: number }> {
    try {
      const supabase = getEnvironmentServerClient();
      let query = supabase
        .from(ErrorLog._tableName)
        .select('*', { count: 'exact' })
        .order('createdAt', { ascending: false });

      if (options.level) {
        query = query.eq('errorLevel', options.level);
      }

      if (options.resolved !== undefined) {
        query = query.eq('resolved', options.resolved);
      }

      if (options.businessId) {
        query = query.eq('businessId', options.businessId);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const errors = data.map(ErrorLog._fromDBSchema);
      return { errors, total: count || 0 };
    } catch (error) {
      handleModelError('Failed to fetch error logs', error);
    }
  }

  /**
   * Gets error statistics
   */
  static async getStats(businessId?: string): Promise<{
    total: number;
    critical: number;
    error: number;
    warn: number;
    resolved: number;
    unresolved: number;
    last24Hours: number;
  }> {
    try {
      const supabase = getEnvironmentServerClient();
      let query = supabase.from(ErrorLog._tableName).select('errorLevel, resolved, createdAt');

      if (businessId) {
        query = query.eq('businessId', businessId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stats = {
        total: data.length,
        critical: data.filter(e => e.errorLevel === 'critical').length,
        error: data.filter(e => e.errorLevel === 'error').length,
        warn: data.filter(e => e.errorLevel === 'warn').length,
        resolved: data.filter(e => e.resolved).length,
        unresolved: data.filter(e => !e.resolved).length,
        last24Hours: data.filter(e => new Date(e.createdAt) > yesterday).length
      };

      return stats;
    } catch (error) {
      handleModelError('Failed to fetch error stats', error);
    }
  }

  /**
   * Marks an error as resolved
   */
  async markResolved(resolvedBy: string, notes?: string): Promise<void> {
    try {
      const supabase = getEnvironmentServerClient();
      
      const { error } = await supabase
        .from(ErrorLog._tableName)
        .update({
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedBy: resolvedBy,
          resolutionNotes: notes
        })
        .eq('id', this.id);

      if (error) {
        throw error;
      }

      this.resolved = true;
      this.resolvedAt = new Date().toISOString();
      this.resolvedBy = resolvedBy;
      this.resolutionNotes = notes;
    } catch (error) {
      handleModelError('Failed to mark error as resolved', error);
    }
  }

  /**
   * Converts database schema to model
   */
  private static _fromDBSchema(dbData: ErrorLogDBSchema): ErrorLog {
    return new ErrorLog({
      id: dbData.id,
      errorLevel: dbData.errorLevel,
      errorType: dbData.errorType,
      errorMessage: dbData.errorMessage,
      errorStack: dbData.errorStack,
      url: dbData.url,
      method: dbData.method,
      userId: dbData.userId,
      businessId: dbData.businessId,
      chatSessionId: dbData.chatSessionId,
      userAgent: dbData.userAgent,
      ipAddress: dbData.ipAddress,
      requestBody: dbData.requestBody,
      queryParams: dbData.queryParams,
      environment: dbData.environment,
      version: dbData.version,
      additionalContext: dbData.additionalContext,
      resolved: dbData.resolved,
      resolvedAt: dbData.resolvedAt,
      resolvedBy: dbData.resolvedBy,
      resolutionNotes: dbData.resolutionNotes,
      createdAt: dbData.createdAt,
      updatedAt: dbData.updatedAt
    });
  }
} 