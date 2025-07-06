# Booking Flow Step 1 Integration Test - Service Selection

## Project Context & Architecture

### **System Overview:**
You are creating integration tests for a **WhatsApp booking bot** that handles real customer booking flows. The system processes WhatsApp messages through a complete pipeline: `Webhook → Message Parsing → Flow Controller → Step Handlers → Database → Response`.

### **Final System Architecture:**
This is **Step 1 of a multi-step booking flow** that we'll build incrementally:

```
Booking Flow Steps:
1. 🎯 SERVICE SELECTION (Current Focus)
2. Additional Services 
3. Time/Date Selection
4. Address (if mobile service)
5. Quote Summary
6. Booking Creation
7. Confirmation

Testing Architecture (Future):
tests/integration/booking/
├── shared/booking-test-utils.ts
├── steps/01-service-selection.test.ts ← THIS FILE
├── steps/02-additional-services.test.ts
├── interruptions/faq-interruptions.test.ts
└── full-flow/happy-path.test.ts
```

### **Current Focus:**
**ONLY Step 1 - Service Selection** to ensure it's perfectly coded before proceeding to other steps.

## Business Context

### **Test Business:** Beauty Asiul
- **Business ID:** `TEST_CONFIG.BUSINESS_ID` (`7c98818f-2b01-4fa4-bbca-0d59922a50f7`)
- **Services:** 12 real services (manicures, pedicures, hair services)
- **Location:** North Melbourne (NO mobile services)
- **Owner:** Luisa Bernal

### **Available Services (Real Database Data):**
- Basic Manicure ($30, 35min)
- Gel Manicure ($40, 60min) 
- Basic Pedicure ($45, 35min)
- Gel Pedicure ($50, 60min)
- Ladies Haircut ($50, 60min)
- Hair Styling ($50, 45min)
- Braids ($30, 90min)
- And 5 more...

## Test Requirements

### **CRITICAL - NO MOCKING/HARDCODING:**
```typescript
// ❌ BAD - Hardcoded values
expect(botResponse).toMatch(/Gel Manicure.*\$40/);

// ✅ GOOD - Dynamic from database
const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
const gelManicure = services.find(s => s.name.toLowerCase().includes('gel manicure'));
expect(botResponse).toMatch(new RegExp(gelManicure.name + '.*\\$' + gelManicure.fixedPrice));
```

### **Dynamic Database Integration:**
- Fetch services directly from `services` table
- **Test MUST fail** if no services found in database
- Tests adapt automatically to database changes
- No hardcoded service names, prices, or IDs

### **Realistic Testing Approach:**
- Use `simulateWebhookPost` like `newUserFlow.test.ts`
- Complete webhook pipeline (NO mocking)
- Real database responses
- Clean session/context after each test

## Step 1 Service Selection - Test Scenarios

### **1. Flow Initiation**
```typescript
describe('Service Selection Step', () => {
  beforeEach(async () => {
    await cleanup(); // Clean sessions/contexts
  });

  test('initiates booking flow correctly', async () => {
    const resp = await simulateWebhookPost({ 
      phone: TEST_PHONE, 
      message: 'start_booking_flow' 
    });
    
    // Verify webhook success
    expect(JSON.stringify(resp)).toMatch(/success/i);
    
    // Verify bot entered service selection step
    const session = await ChatSession.getActiveByChannelUserId(/*...*/);
    const goalData = session.activeGoals[0]?.collectedData;
    
    // Verify services were loaded from database
    expect(goalData.availableServices).toBeDefined();
    expect(goalData.availableServices.length).toBeGreaterThan(0);
    
    // Verify bot shows service selection message
    const botResponse = session.allMessages[session.allMessages.length - 1].content;
    expect(botResponse).toMatch(/select.*service/i);
  });
});
```

### **2. Button-Based Service Selection**
```typescript
test('selects service via button click', async () => {
  // Start booking flow
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'start_booking_flow' });
  
  // Get available services dynamically
  const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
  expect(services.length).toBeGreaterThan(0); // Must have services
  
  const firstService = services[0];
  
  // Select service via button (using service ID)
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: firstService.id 
  });
  
  // Verify selection worked
  const session = await ChatSession.getActiveByChannelUserId(/*...*/);
  const goalData = session.activeGoals[0]?.collectedData;
  
  expect(goalData.selectedService).toBeDefined();
  expect(goalData.selectedService.id).toBe(firstService.id);
  expect(goalData.selectedService.name).toBe(firstService.name);
  
  // Verify bot confirmed selection
  const botResponse = session.allMessages[session.allMessages.length - 1].content;
  expect(botResponse).toMatch(new RegExp(firstService.name, 'i'));
});
```

### **3. Text-Based Service Selection (CRITICAL)**
```typescript
test('selects service via text input - exact match', async () => {
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'start_booking_flow' });
  
  // Get services and find one with a recognizable name
  const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
  const gelManicure = services.find(s => s.name.toLowerCase().includes('gel manicure'));
  expect(gelManicure).toBeDefined(); // Must exist for test
  
  // User types service name instead of clicking button
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'gel manicure' 
  });
  
  // Verify system identified this as service selection (not FAQ)
  const session = await ChatSession.getActiveByChannelUserId(/*...*/);
  const goalData = session.activeGoals[0]?.collectedData;
  
  expect(goalData.selectedService).toBeDefined();
  expect(goalData.selectedService.id).toBe(gelManicure.id);
  
  // Verify bot confirmed correct service
  const botResponse = session.allMessages[session.allMessages.length - 1].content;
  expect(botResponse).toMatch(new RegExp(gelManicure.name, 'i'));
});

test('selects service via text input - partial match', async () => {
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'start_booking_flow' });
  
  const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
  const basicManicure = services.find(s => s.name.toLowerCase().includes('basic manicure'));
  expect(basicManicure).toBeDefined();
  
  // User types partial name
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'basic mani' 
  });
  
  const session = await ChatSession.getActiveByChannelUserId(/*...*/);
  const goalData = session.activeGoals[0]?.collectedData;
  
  expect(goalData.selectedService.id).toBe(basicManicure.id);
});
```

### **4. Invalid Service Handling**
```typescript
test('handles invalid service selection correctly', async () => {
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'start_booking_flow' });
  
  // User requests service that doesn't exist
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'massage' 
  });
  
  const session = await ChatSession.getActiveByChannelUserId(/*...*/);
  const goalData = session.activeGoals[0]?.collectedData;
  
  // Verify service was NOT selected
  expect(goalData.selectedService).toBeUndefined();
  
  // Verify bot provided helpful error with available options
  const botResponse = session.allMessages[session.allMessages.length - 1].content;
  expect(botResponse).toMatch(/couldn't find|not available/i);
  
  // Verify bot listed actual available services
  const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
  const firstServiceName = services[0].name;
  expect(botResponse).toMatch(new RegExp(firstServiceName, 'i'));
});
```

### **5. FAQ Interruption During Service Selection**
```typescript
test('handles FAQ interruption while in service selection', async () => {
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'start_booking_flow' });
  
  // User asks FAQ question instead of selecting service
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'where are you located?' 
  });
  
  const session = await ChatSession.getActiveByChannelUserId(/*...*/);
  const goalData = session.activeGoals[0]?.collectedData;
  
  // Verify still in booking flow (service not selected)
  expect(goalData.selectedService).toBeUndefined();
  expect(session.activeGoals[0].goalType).toBe('serviceBooking');
  
  // Verify bot answered FAQ
  const botResponse = session.allMessages[session.allMessages.length - 1].content;
  expect(botResponse).toMatch(/west melbourne|dryburgh/i);
  
  // Verify still showing service options
  // Note: This may require checking message history or button state
});
```

### **6. Multiple Variation Testing**
```typescript
test('handles various ways to request same service', async () => {
  const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
  const gelManicure = services.find(s => s.name.toLowerCase().includes('gel manicure'));
  expect(gelManicure).toBeDefined();
  
  const variations = [
    'gel manicure',
    'gel mani',
    'shellac manicure',
    'gel nails',
    'gel polish'
  ];
  
  for (const variation of variations) {
    await cleanup(); // Clean between variations
    
    await simulateWebhookPost({ phone: TEST_PHONE, message: 'start_booking_flow' });
    const resp = await simulateWebhookPost({ phone: TEST_PHONE, message: variation });
    
    const session = await ChatSession.getActiveByChannelUserId(/*...*/);
    const goalData = session.activeGoals[0]?.collectedData;
    
    // All variations should select the gel manicure service
    expect(goalData.selectedService?.id).toBe(gelManicure.id);
    
    console.log(`✅ "${variation}" correctly selected: ${goalData.selectedService?.name}`);
  }
});
```

## Implementation Requirements

### **File Structure:**
```typescript
// tests/integration/booking/steps/01-service-selection.test.ts

import { simulateWebhookPost } from '../../utils';
import { ChatSession } from '@/lib/database/models/chat-session';
import { Service } from '@/lib/database/models/service';
import { UserContext } from '@/lib/database/models/user-context';
import { BOT_CONFIG } from '@/lib/bot-engine/types';
import { TEST_CONFIG, getNormalizedTestPhone } from '../../../config/test-config';

// Add to test-config.ts if needed:
export const TEST_CONFIG = {
  BUSINESS_ID: '7c98818f-2b01-4fa4-bbca-0d59922a50f7',
  TEST_PHONE_NUMBER: '+15551234567',
  TEST_USER_NAME: 'TestUser',
  TIMEOUT_SECONDS: 30
};
```

### **Cleanup Function:**
```typescript
async function cleanup() {
  await deleteChatSessionsForUser(TEST_CONFIG.TEST_PHONE_NUMBER);
  await deleteUserByWhatsapp(TEST_CONFIG.TEST_PHONE_NUMBER);
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    getNormalizedTestPhone(),
    TEST_CONFIG.BUSINESS_ID
  );
  if (ctx) await UserContext.delete(ctx.id);
}
```

### **Dynamic Service Verification:**
```typescript
// Always fetch services dynamically
const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
expect(services.length).toBeGreaterThan(0); // Test fails if no services

// Find services by properties, not hardcoded names
const gelServices = services.filter(s => 
  s.name.toLowerCase().includes('gel') && 
  s.name.toLowerCase().includes('manicure')
);
```

## Success Criteria

### **Test Must Verify:**
1. ✅ Booking flow initiates correctly
2. ✅ Services loaded from real database
3. ✅ Button selection works
4. ✅ Text input selection works (exact & partial match)
5. ✅ Invalid service handled gracefully
6. ✅ FAQ interruptions handled while preserving booking context
7. ✅ Multiple input variations work for same service
8. ✅ Bot responses contain real service data (names, prices)
9. ✅ No hardcoded values - all dynamic from database
10. ✅ Proper cleanup between tests

### **Integration Points Tested:**
- Complete webhook pipeline
- Message parsing and validation
- Flow controller step management
- Service database queries
- Response generation and localization
- Session state persistence

Generate comprehensive integration tests that cover ALL these scenarios with real database integration and zero mocking. Focus ONLY on Step 1 service selection to ensure it's bulletproof before proceeding to additional steps. 