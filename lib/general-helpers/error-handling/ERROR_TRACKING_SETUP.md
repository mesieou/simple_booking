# Error Tracking & Alerting System

A simple but comprehensive error tracking system for your production application that logs errors to the database and sends email alerts.

## 🚀 Setup Instructions

### 1. Run Database Migration

First, run the database migration to create the `errorLogs` table:

```bash
# Apply the migration to your Supabase database
# Copy the contents of lib/database/migrations/004_create_error_logs.sql
# and run it in your Supabase SQL editor
```

### 2. Environment Variables

Add these environment variables to your `.env.local`:

```bash
# Error Tracking Configuration
ERROR_ALERTS_ENABLED=true
ERROR_ALERT_EMAILS=admin@yourdomain.com,alerts@yourdomain.com

# Optional: Configure alert thresholds (defaults shown)
ERROR_ALERT_CRITICAL_THRESHOLD=1
ERROR_ALERT_ERROR_THRESHOLD=5
ERROR_ALERT_TIMEFRAME_MINUTES=15
```

### 3. Setup Global Error Handlers

Add error boundary to your main layout:

```tsx
// app/layout.tsx
import { ErrorBoundary, setupGlobalErrorHandlers } from '@/components/error-boundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Setup global error handlers on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setupGlobalErrorHandlers();
    }
  }, []);

  return (
    <html>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

## 📝 Usage Examples

### 1. Wrap API Routes with Error Handler

```typescript
// app/api/your-route/route.ts
import { withErrorHandler, ApiErrorTypes } from '@/lib/middleware/error-handler';

const handler = async (req: NextRequest) => {
  // Your API logic here
  if (!someCondition) {
    throw ApiErrorTypes.BadRequest('Invalid input provided');
  }
  
  return NextResponse.json({ success: true });
};

export const POST = withErrorHandler(handler);
```

### 2. Manual Error Logging

```typescript
import { productionErrorTracker } from '@/lib/general-helpers/error-handling/production-error-tracker';

// Log different types of errors
await productionErrorTracker.logCriticalError('PAYMENT_FAILED', error, { userId, businessId });
await productionErrorTracker.logDatabaseError(error, { table: 'users', operation: 'insert' });
await productionErrorTracker.logBotError(error, { chatSessionId, userMessage });
```

### 3. Database Operations with Error Handling

**Option A: Using middleware wrapper:**
```typescript
import { withDatabaseErrorHandling } from '@/lib/middleware/error-handler';

const result = await withDatabaseErrorHandling(
  () => supabase.from('users').insert(userData),
  { operation: 'user_creation', userId }
);
```

**Option B: Using enhanced model error handler (recommended for models):**
```typescript
import { handleModelErrorWithContext } from '@/lib/general-helpers/error-handling/model-error-handler';

try {
  const result = await supabase.from('users').insert(userData);
  if (result.error) {
    handleModelErrorWithContext('Failed to create user', result.error, {
      operation: 'create',
      table: 'users',
      userId: userData.id,
      businessId: userData.businessId,
      data: { email: userData.email } // Don't log sensitive data
    });
  }
} catch (error) {
  handleModelErrorWithContext('User creation failed', error, {
    operation: 'create',
    table: 'users',
    userId: userData.id
  });
}
```

### 4. External API Calls with Error Handling

```typescript
import { withExternalApiErrorHandling } from '@/lib/middleware/error-handler';

const result = await withExternalApiErrorHandling(
  () => fetch('https://api.example.com/data'),
  'ExampleAPI',
  { endpoint: '/data', method: 'GET' }
);
```

### 5. Client-Side Error Reporting

```tsx
import { useErrorReporting } from '@/components/error-boundary';

function MyComponent() {
  const { reportError } = useErrorReporting();
  
  const handleAction = async () => {
    try {
      // Some action that might fail
      await riskyOperation();
    } catch (error) {
      // Manually report the error
      await reportError(error, { 
        component: 'MyComponent', 
        action: 'handleAction' 
      });
    }
  };
}
```

## 📊 Error Dashboard

Access the error dashboard at: `/error-dashboard`

The dashboard shows:
- Error statistics (total, critical, resolved, etc.)
- Recent errors with filtering
- Error details and context
- Ability to mark errors as resolved

## 🔔 Email Alerts

Email alerts are automatically sent when:
- **Critical errors**: Immediately (after 1 critical error)
- **Regular errors**: After 5 errors within 15 minutes

Configure recipients with the `ERROR_ALERT_EMAILS` environment variable.

## 🏗️ System Architecture

1. **ErrorLog Model** (`lib/database/models/error-log.ts`): Database operations
2. **Production Error Tracker** (`lib/general-helpers/error-handling/production-error-tracker.ts`): Main error logging and alerting
3. **Error Middleware** (`lib/middleware/error-handler.ts`): API route wrappers
4. **Model Error Handler** (`lib/general-helpers/error-handling/model-error-handler.ts`): Integrated database error handling
5. **Error Boundary** (`components/error-boundary.tsx`): Client-side error catching
6. **Error API** (`app/api/errors/`): API endpoints for logging and retrieving errors
7. **Error Dashboard** (`app/error-dashboard/`): UI for viewing errors

## 🔗 Integrated Error Handling

The system now integrates your existing database error handling with the new comprehensive error tracking:

### Legacy `handleModelError` (still works)
- Continues to work exactly as before
- Now **automatically** logs to the error tracking system
- No code changes needed in existing models

### Enhanced `handleModelErrorWithContext` (recommended)
- Provides richer context for better debugging
- Links errors to specific users/businesses
- Tracks operations and table names
- Better for troubleshooting production issues

**Benefits of Integration:**
- ✅ All database errors are now automatically tracked
- ✅ Email alerts for critical database issues
- ✅ Dashboard visibility into database problems
- ✅ No breaking changes to existing code
- ✅ Enhanced context for new implementations

## 📋 Error Types

The system categorizes errors into these types:
- `API_ERROR`: Server-side API errors
- `DATABASE_ERROR`: Database operation failures (now auto-captured from models)
- `BOT_ERROR`: Chatbot-related errors
- `PAYMENT_ERROR`: Payment processing errors
- `CLIENT_SIDE_ERROR`: React component errors
- `EXTERNAL_API_ERROR`: Third-party service errors
- `VALIDATION_ERROR`: Input validation failures

**Database Error Context Enhancement:**
All database errors now include rich context like:
- Operation type (create, update, delete, etc.)
- Table name
- User/Business ID (when available)
- Original error details from Supabase
- Stack trace for debugging

## 🔧 Customization

### Custom Error Types

Add new error types in your code:

```typescript
await productionErrorTracker.logError('error', 'CUSTOM_ERROR_TYPE', error, context);
```

### Custom Alert Templates

Modify the email template in `ProductionErrorTracker.formatErrorAlertMessage()`.

### Dashboard Enhancements

The dashboard is a simple React component that can be extended with:
- Charts and graphs
- More detailed filtering
- Export functionality
- Real-time updates

## 🚨 Production Tips

1. **Monitor Critical Errors**: Set up immediate notifications for critical errors
2. **Regular Reviews**: Check the dashboard daily for error trends
3. **Performance**: Error logging is async and won't slow down your app
4. **Privacy**: Be careful not to log sensitive data in error contexts
5. **Cleanup**: Consider implementing error log retention policies

## 🛟 Troubleshooting

### No Emails Received
- Check `ERROR_ALERTS_ENABLED=true`
- Verify `ERROR_ALERT_EMAILS` contains valid addresses
- Check email provider configuration
- Look at console logs for email sending errors

### Dashboard Not Loading
- Verify database migration was applied
- Check API endpoints `/api/errors` and `/api/errors/stats`
- Look at browser console for client-side errors

### Errors Not Being Logged
- Check that error handlers are properly wrapped
- Verify database connection
- Look at server logs for error tracking failures

## 📈 Next Steps

Consider upgrading to more advanced error tracking services like:
- Sentry
- Bugsnag
- LogRocket
- Datadog

But this simple system will serve you well for getting started and understanding your error patterns! 