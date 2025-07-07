/**
 * Demo script showcasing the new bot-engine logging system
 * This demonstrates the different log levels and journey tracking
 */

import { createLogger, printJourney } from './logger';

// Create loggers for different components
const demoLogger = createLogger('Demo');
const messageLogger = createLogger('MessageProcessor');
const flowLogger = createLogger('FlowController');

export function demonstrateLogging() {
  const sessionId = 'demo-session-12345';
  const userId = 'user-67890';
  
  console.log('\n🎬 Bot Engine Logging System Demo\n');
  console.log('========================================\n');

  // 1. Journey tracking - high-level flow milestones
  demoLogger.journey('User started booking flow', { 
    sessionId, 
    userId,
    goalType: 'serviceBooking' 
  });

  // 2. Flow decisions - step transitions and routing
  messageLogger.flow('Routing to booking flow', { 
    sessionId, 
    userId,
    goalType: 'serviceBooking',
    step: 'selectService' 
  }, { 
    routingReason: 'explicit_booking_start' 
  });

  // 3. Information logs - general processing info
  flowLogger.info('Advanced to next step', { 
    sessionId,
    goalType: 'serviceBooking',
    step: 'showAvailableTimes' 
  }, { 
    stepIndex: 2,
    skipCount: 0 
  });

  // 4. Debug logs (only shown in development)
  demoLogger.debug('Processing step validation', { 
    sessionId,
    step: 'selectService' 
  }, { 
    hasSelectedService: false,
    validationRules: ['required_field', 'valid_format'] 
  });

  // 5. Performance tracking
  demoLogger.startTimer('step_processing', { sessionId, step: 'selectService' });
  
  // Simulate some processing time
  setTimeout(() => {
    const duration = demoLogger.endTimer('step_processing', { sessionId, step: 'selectService' });
    
    // 6. Warning logs
    if (duration > 1000) {
      demoLogger.warn('Step processing took longer than expected', { 
        sessionId,
        step: 'selectService' 
      }, { duration });
    }

    // 7. Error handling
    try {
      // Simulate error
      throw new Error('Service validation failed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined;
      
      demoLogger.error('Service validation error', { 
        sessionId,
        step: 'selectService' 
      }, { 
        error: errorMessage,
        stack: errorStack 
      });
    }

    // 8. More journey steps
    messageLogger.journey('Service selected successfully', { 
      sessionId,
      userId,
      goalType: 'serviceBooking',
      step: 'showAvailableTimes'
    }, { 
      selectedService: 'house-cleaning',
      price: 150 
    });

    flowLogger.journey('Booking completed', { 
      sessionId,
      userId,
      goalType: 'serviceBooking' 
    }, { 
      totalSteps: 6,
      completionTime: '2.5min' 
    });

    // 9. Print complete journey summary
    console.log('\n📊 Journey Summary:');
    printJourney(sessionId);

    console.log('\n✅ Demo completed! Here are the key features:\n');
    console.log('🚀 JOURNEY logs: High-level milestones (always visible)');
    console.log('→ FLOW logs: Step transitions and decisions');
    console.log('ℹ️  INFO logs: General processing information');
    console.log('🐛 DEBUG logs: Detailed troubleshooting (dev only)');
    console.log('⚠️  WARN logs: Performance and unusual conditions');
    console.log('❌ ERROR logs: Exceptions and failures');
    console.log('⏱️  Performance: Automatic timing for operations');
    console.log('🗺️  Journey tracking: Complete user flow visualization\n');

  }, 100);
}

// Example usage patterns for different scenarios
export function logBookingFlow() {
  const logger = createLogger('BookingFlow');
  const sessionId = 'booking-789';
  
  // Start of booking
  logger.journey('Booking flow initiated', { sessionId, goalType: 'serviceBooking' });
  
  // Service selection
  logger.flow('Processing service selection', { sessionId, step: 'selectService' });
  logger.info('Available services loaded', { sessionId }, { serviceCount: 5 });
  
  // User selection
  logger.flow('Service selected by user', { sessionId, step: 'selectService' }, { 
    serviceId: 'cleaning-basic',
    serviceName: 'Basic House Cleaning' 
  });
  
  // Navigation
  logger.flow('Advancing to time selection', { sessionId, step: 'showAvailableTimes' });
  
  // Completion
  logger.journey('Booking created successfully', { sessionId, goalType: 'serviceBooking' }, {
    bookingId: 'booking-456',
    totalDuration: '3.2min'
  });
}

export function logErrorScenario() {
  const logger = createLogger('ErrorHandling');
  const sessionId = 'error-123';
  
  logger.journey('Processing payment', { sessionId, goalType: 'serviceBooking' });
  
  try {
    // Simulate payment failure
    throw new Error('Payment gateway timeout');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Payment processing failed', { 
      sessionId,
      step: 'processPayment' 
    }, { 
      errorType: 'gateway_timeout',
      paymentId: 'pay_123',
      amount: 150,
      error: errorMessage 
    });
    
    logger.flow('Redirecting to payment retry', { sessionId, step: 'retryPayment' });
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateLogging();
} 