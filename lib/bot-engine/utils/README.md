# Bot Engine Logging System 🚀

A comprehensive, structured logging system that traces the complete user journey through the bot-engine without overwhelming developers with too much detail.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Log Levels](#log-levels)  
3. [Reducing Verbosity](#reducing-verbosity) ⭐ **NEW**
4. [Quick Start](#quick-start)
5. [Journey Tracking](#journey-tracking)
6. [Performance Monitoring](#performance-monitoring)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

## Overview

The logging system provides:
- **Structured logging** with consistent formatting
- **Journey tracking** to trace complete user flows
- **Performance monitoring** with automatic timing
- **Context-aware logs** with session/user information
- **Log level filtering** to control verbosity
- **Visual indicators** for different log types
- **Legacy log filtering** to reduce noise ⭐ **NEW**

### Visual Log Format

```
🚀 [MessageProcessor] Payment completion detected (session:a1b2c3d4, user:+1234567)
→ [FlowController] Advanced to step (goal:serviceBooking, step:createBooking)
ℹ️  [StatePersister] Session state persisted [152ms]
```

## Reducing Verbosity ⭐

### The Problem
By default, the system generates a lot of legacy logging noise like:
```bash
[Environment] Using development environment for service-role client
[User] Finding customer user by WhatsApp number: 61473164581
[User] Normalized input customer WhatsApp number: 61473164581
[User] Found user record for customer with WhatsApp number, user ID: 09c5808e-c1bd-43c0-94f5-a06679964f32
[Environment] Using development environment for service-role client
[SessionLogic] No previous session found for whatsapp:61473164581 - starting with empty history
[Environment] Using development environment for service-role client
[HistoryExtractor] DEBUG - Found existing UserContext: { ... }
[StatePersister] DEBUG - Incoming userContext: { ... }
[StatePersister] DEBUG - Current goal being processed: { ... }
[StatePersister] DEBUG - Updated context: { ... }
```

### The Solution: Clean Logs 🧹

**Option 1: Quick Enable (Recommended)**
```typescript
// Add this single import to any main file (like a webhook handler)
import '@/lib/bot-engine/utils/enable-clean-logs';

// That's it! Noise is now filtered out.
```

**Option 2: Manual Control**
```typescript
import { enableLogFiltering, disableLogFiltering } from '@/lib/bot-engine/utils/log-filter';

// Enable filtering
enableLogFiltering();

// Later, disable if you need full verbosity for debugging
disableLogFiltering();
```

### What Gets Filtered

✅ **Keeps visible (our new structured logs):**
```bash
🚀 [WhatsAppHandler] Message processing pipeline started (user:61473164, session:fcbeaeb2)
→ [WhatsAppHandler] Message routing analysis completed 
🚀 [MessageProcessor] Message processing started
→ [MessageProcessor] Explicit booking start command detected
🚀 [MessageProcessor] New booking goal created
```

🔇 **Filters out (legacy noise):**
- `[Environment]` - Database environment messages (shown 10+ times)
- `[User] Finding/Found/Normalized` - User lookup details  
- `[SessionLogic]` - Session management internals
- `[HistoryExtractor] DEBUG` - Context creation details
- `[StatePersister] DEBUG` - State persistence internals
- Duplicate webhook processing logs
- WhatsApp API technical details

📝 **Throttles (reduces frequency):**
- Business lookups (once per 8 seconds)
- State updates (once per 5 seconds)  
- User context operations (once per 10 seconds)

### Result: Clean, Focused Output

**BEFORE (overwhelming):**
```bash
[Environment] Using development environment for service-role client
[User] Finding customer user by WhatsApp number: 61473164581
[User] Normalized input customer WhatsApp number: 61473164581
[User] Found user record for customer with WhatsApp number, user ID: 09c5808e-c1bd-43c0-94f5-a06679964f32
[Environment] Using development environment for service-role client
[SessionLogic] No previous session found - starting with empty history
[Environment] Using development environment for service-role client
[HistoryExtractor] DEBUG - Found existing UserContext: {...}
[StatePersister] DEBUG - Incoming userContext: {...}
🚀 [WhatsAppHandler] Message processing pipeline started
[Environment] Using development environment for service-role client
[StatePersister] DEBUG - Current goal being processed: {...}
→ [WhatsAppHandler] Message routing analysis completed
[StatePersister] DEBUG - Updated context: {...}
🚀 [MessageProcessor] Message processing started
[StatePersister] Adding message pair: user="hello", bot="Hi there!"
[StatePersister] Successfully updated UserContext for 61473164581
```

**AFTER (clean & focused):**
```bash
🔄 [Session] New session created
👤 [User] Context initialized  
🚀 [WhatsAppHandler] Message processing pipeline started (user:61473164, session:fcbeaeb2)
→ [WhatsAppHandler] Message routing analysis completed 
🚀 [MessageProcessor] Message processing started (user:61473164, session:fcbeaeb2)
→ [MessageProcessor] Explicit booking start command detected
🚀 [MessageProcessor] New booking goal created (goal:serviceBooking, step:selectService)
💾 [State] Session updated
```

## Log Levels

### 🚀 JOURNEY - High-level flow milestones
**When to use:** Major user actions, goal completions, routing decisions
```typescript
logger.journey('Booking flow started', { sessionId, goalType: 'serviceBooking' });
logger.journey('Payment completed successfully', { sessionId, userId });
```

### → FLOW - Step transitions and navigation
**When to use:** Step changes, routing decisions, navigation logic
```typescript
logger.flow('Advanced to next step', { step: 'selectService' });
logger.flow('Smart jump to quote summary', { reason: 'complete_booking_data' });
```

### ℹ️ INFO - General processing information
**When to use:** Successful operations, data loaded, configurations
```typescript
logger.info('Services loaded successfully', {}, { serviceCount: 5 });
logger.info('Goal created from payment', { goalType: 'serviceBooking' });
```

### 🐛 DEBUG - Detailed troubleshooting (dev only)
**When to use:** Validation checks, internal state, detailed processing
```typescript
logger.debug('Step validation check', { step: 'selectService' }, { hasData: false });
```

### ⚠️ WARN - Performance issues and unusual conditions
**When to use:** Slow operations, missing data, fallback scenarios
```typescript
logger.warn('LLM request took longer than expected', {}, { duration: 5000 });
```

### ❌ ERROR - Exceptions and failures
**When to use:** Caught exceptions, failed operations, critical issues
```typescript
logger.error('Payment processing failed', { step: 'payment' }, { error: err.message });
```

## Quick Start

### 1. Enable clean logging (recommended first step)

```typescript
// Add this import to your main webhook or entry point
import '@/lib/bot-engine/utils/enable-clean-logs';
```

### 2. Import the logger for your component

```typescript
import { createLogger } from '@/lib/bot-engine/utils/logger';

// Or use pre-configured loggers
import { MessageProcessorLogger, FlowControllerLogger } from '@/lib/bot-engine/utils/logger';
```

### 3. Create a component-specific logger

```typescript
const logger = createLogger('YourComponent');
```

### 4. Add logging to key points

```typescript
// High-level milestones
logger.journey('User started booking', { sessionId, goalType: 'serviceBooking' });

// Step transitions
logger.flow('Processing service selection', { sessionId, step: 'selectService' });

// General information
logger.info('Services loaded', { sessionId }, { count: services.length });

// Performance tracking
logger.startTimer('service_lookup');
const services = await getServices();
logger.endTimer('service_lookup', { sessionId });
```

## Journey Tracking

### Automatic Journey Building
The system automatically tracks JOURNEY-level logs and builds a complete user flow:

```typescript
// These calls...
logger.journey('Booking started', { sessionId: 'abc123' });
logger.journey('Service selected', { sessionId: 'abc123' });
logger.journey('Payment completed', { sessionId: 'abc123' });

// Generate this summary:
printJourney('abc123');
```

**Output:**
```
🗺️  Journey Summary for session: abc123
================================================
1. [14:32:15] MessageProcessor → Booking started
2. [14:32:45] FlowController → Service selected  
3. [14:35:22] PaymentHandler → Payment completed
================================================
```

### Manual Journey Tracking
You can also manually track specific steps:

```typescript
logger.trackStep('user_authentication_completed', { sessionId, userId });
logger.trackStep('booking_data_validated', { sessionId, step: 'validation' });
```

## Performance Monitoring

### Automatic Timing
```typescript
// Start timing an operation
logger.startTimer('llm_analysis', { sessionId, step: 'goal_detection' });

// ... do work ...

// End timing (automatically logs duration)
const duration = logger.endTimer('llm_analysis', { sessionId, step: 'goal_detection' });
// Outputs: [MessageProcessor] llm_analysis completed (session:abc123, step:goal_detection) [1250ms]
```

### Manual Performance Logging
```typescript
const startTime = Date.now();
await processPayment();
const duration = Date.now() - startTime;

if (duration > 3000) {
  logger.warn('Payment processing slow', { sessionId }, { duration });
}
```

## Best Practices

### ✅ DO

**1. Enable clean logging first**
```typescript
// Always start with this for development
import '@/lib/bot-engine/utils/enable-clean-logs';
```

**2. Use consistent context**
```typescript
const context = { sessionId, userId, goalType, step };
logger.journey('Milestone reached', context);
logger.flow('Step transition', context);
```

**3. Include relevant data**
```typescript
logger.info('Quote generated', { sessionId }, { 
  amount: quote.total, 
  serviceCount: quote.services.length,
  duration: quote.estimatedDuration 
});
```

**4. Log at the right level**
```typescript
// Major milestones
logger.journey('Booking completed successfully');

// Step changes
logger.flow('Advanced to payment step');

// Detailed info
logger.debug('Validating user input', {}, { input: userInput });
```

**5. Use performance tracking**
```typescript
logger.startTimer('expensive_operation');
await expensiveOperation();
logger.endTimer('expensive_operation');
```

### ❌ DON'T

**1. Log sensitive information**
```typescript
// BAD
logger.info('User data', {}, { password: user.password, creditCard: user.cc });

// GOOD  
logger.info('User authenticated', { userId: user.id });
```

**2. Over-log in loops**
```typescript
// BAD
services.forEach(service => {
  logger.info('Processing service', {}, { service });
});

// GOOD
logger.info('Processing services', {}, { count: services.length });
services.forEach(service => {
  // ... process without logging each iteration
});
logger.info('Services processed successfully');
```

**3. Use wrong log levels**
```typescript
// BAD - DEBUG for important milestones
logger.debug('Payment completed');

// GOOD - JOURNEY for important milestones
logger.journey('Payment completed successfully', { sessionId, userId });
```

## Examples

### Clean Development Setup
```typescript
// webhook handler or main entry point
import '@/lib/bot-engine/utils/enable-clean-logs'; // Add this first!
import { MessageProcessorLogger } from '@/lib/bot-engine/utils/logger';

export class MessageProcessor {
  async processMessage(message: string, user: User, sessionId: string) {
    // Now you'll see clean, focused logs without noise
    MessageProcessorLogger.journey('Message processing started', {
      sessionId,
      userId: user.id
    }, { 
      messagePreview: message.substring(0, 50),
      messageType: 'text' 
    });

    // Your processing logic here...
  }
}
```

### Message Processing Flow
```typescript
export class MessageProcessor {
  async processMessage(message: string, user: User, sessionId: string) {
    // Major milestone
    MessageProcessorLogger.journey('Message processing started', {
      sessionId,
      userId: user.id
    }, { 
      messagePreview: message.substring(0, 50),
      messageType: 'text' 
    });

    // Performance tracking
    MessageProcessorLogger.startTimer('total_processing', { sessionId });

    // Flow decision
    if (isBookingRelated(message)) {
      MessageProcessorLogger.flow('Routing to booking flow', {
        sessionId,
        goalType: 'serviceBooking'
      }, { routingReason: 'booking_keywords_detected' });
      
      return this.handleBookingFlow(message, user, sessionId);
    }

    // Alternative flow
    MessageProcessorLogger.flow('Routing to FAQ handler', {
      sessionId
    }, { reason: 'no_booking_context' });

    const response = await this.handleFAQ(message);
    
    // Complete with timing
    MessageProcessorLogger.endTimer('total_processing', { sessionId });
    
    return response;
  }
}
```

### Error Handling
```typescript
export class PaymentProcessor {
  async processPayment(paymentData: PaymentData, sessionId: string) {
    PaymentLogger.journey('Payment processing started', { sessionId });
    
    try {
      PaymentLogger.startTimer('stripe_api_call', { sessionId });
      
      const result = await stripe.charges.create(paymentData);
      
      PaymentLogger.endTimer('stripe_api_call', { sessionId });
      
      PaymentLogger.journey('Payment completed successfully', { 
        sessionId 
      }, { 
        amount: result.amount,
        chargeId: result.id 
      });
      
      return result;
      
    } catch (error) {
      PaymentLogger.error('Payment processing failed', {
        sessionId,
        step: 'stripe_charge'
      }, {
        errorType: error.type,
        errorCode: error.code,
        amount: paymentData.amount
      });
      
      // Continue with fallback flow
      PaymentLogger.flow('Redirecting to payment retry', { sessionId });
      throw error;
    }
  }
}
```

### Journey Analysis
```typescript
// Print complete journey for debugging
import { printJourney } from '@/lib/bot-engine/utils/logger';

// After processing a session
printJourney(sessionId);

// Output:
// 🗺️  Journey Summary for session: abc123
// ================================================
// 1. [14:30:15] WhatsAppHandler → Message received
// 2. [14:30:16] MessageProcessor → Booking flow started
// 3. [14:30:45] FlowController → Service selected
// 4. [14:31:12] FlowController → Time slot selected  
// 5. [14:32:18] PaymentHandler → Payment completed
// 6. [14:32:19] BookingHandler → Booking created
// ================================================
```

## Integration with Existing Code

The logging system is already integrated into key components:

- ✅ **MessageProcessor** - Journey tracking and flow decisions
- ✅ **FlowController** - Step navigation and smart routing  
- ✅ **WhatsApp Handlers** - Entry point and message routing
- ✅ **Log Filtering** - Legacy noise reduction ⭐ **NEW**
- 🔄 **Individual Step Handlers** - Add as needed
- 🔄 **LLM Service** - Add for AI decision tracking
- 🔄 **Payment Processing** - Add for transaction flow

To add logging to new components:

1. **Enable clean logs first**: `import '@/lib/bot-engine/utils/enable-clean-logs';`
2. Import the logger: `import { createLogger } from '@/lib/bot-engine/utils/logger';`
3. Create component logger: `const logger = createLogger('YourComponent');`
4. Add journey milestones, flow decisions, and error handling
5. Use performance tracking for slow operations

## Environment Configuration

The logging system automatically adjusts based on environment:

- **Development**: All log levels visible including DEBUG
- **Production**: DEBUG logs are hidden, others remain visible, log filtering auto-enabled
- **Journey logs**: Always visible in all environments

This ensures you can trace user journeys in production without performance impact from debug logs. 