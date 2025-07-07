# Booking Flow Step 2 Integration Test - Additional Services Selection

## Project Context & Architecture

### **System Overview:**
You are creating integration tests for a **WhatsApp booking bot** that handles real customer booking flows. The system processes WhatsApp messages through a complete pipeline: `Webhook → Message Parsing → Flow Controller → Step Handlers → Database → Response`.

### **Final System Architecture:**
This is **Step 2 of a multi-step booking flow** that we'll build incrementally:

```
Booking Flow Steps:
1. Service Selection (✅ COMPLETED)
2. 🎯 ADDITIONAL SERVICES SELECTION (Current Focus)
3. Time/Date Selection
4. Address (if mobile service)
5. Quote Summary
6. Booking Creation
7. Confirmation

Testing Architecture (Future):
tests/integration/booking/
├── shared/booking-test-utils.ts
├── steps/01-service-selection.test.ts (✅ COMPLETED)
├── steps/02-additional-services.test.ts ← THIS FILE
├── interruptions/faq-interruptions.test.ts
└── full-flow/happy-path.test.ts
```

### **Current Focus:**
**ONLY Step 2 - Additional Services Selection** to ensure it's perfectly coded before proceeding to other steps.

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
expect(botResponse).toMatch(/Basic Manicure.*\$30/);

// ✅ GOOD - Dynamic from database
const services = await Service.getByBusiness(TEST_CONFIG.BUSINESS_ID);
const basicManicure = services.find(s => s.name.toLowerCase().includes('basic manicure'));
expect(botResponse).toMatch(new RegExp(basicManicure.name + '.*\\$' + basicManicure.fixedPrice));
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
- **REUSE components from Step 1:** `booking-test-utils.ts`, helper functions

## Step 2 Additional Services Selection - Architecture

### **Step Handler:** `add-additional-services.ts`
The system has TWO distinct states:

1. **`confirming` state:** Shows continuation buttons
   - Button: `add_another_service` → Switch to selecting state
   - Button: `continue_with_services` → Proceed to next step

2. **`selecting` state:** Shows filtered service list
   - Displays only services NOT already selected
   - Same service selection logic as Step 1
   - Returns to `confirming` state after selection

### **Key Functions to Test:**
- `BookingValidator.validateServiceContinuation()` - Validates button inputs
- `BookingValidator.validateServiceSelection()` - Validates service selection
- `BookingButtonGenerator.createServiceContinuationButtons()` - Creates action buttons
- `ServiceDataProcessor.filterAvailableServices()` - Filters out selected services

## Step 2 Additional Services Selection - Test Scenarios

### **1. Flow Entry from Step 1**
```typescript
describe('Additional Services Selection Step', () => {
  beforeEach(async () => {
    await cleanup(); // Clean sessions/contexts
  });

  test('enters additional services step after service selection', async () => {
    // Complete Step 1 first
    await startBookingFlow();
    
    const services = await fetchServices();
    const firstService = services[0];
    
    // Select first service
    const resp = await simulateWebhookPost({ 
      phone: TEST_PHONE, 
      message: firstService.id 
    });
    expect(JSON.stringify(resp)).toMatch(/success/i);
    
    // Verify we're now in Step 2 (additional services)
    const session = await getActiveSession();
    const goalData = await getGoalData();
    
    expect(goalData.selectedServices).toBeDefined();
    expect(goalData.selectedServices.length).toBe(1);
    expect(goalData.selectedServices[0].id).toBe(firstService.id);
    expect(goalData.addServicesState).toBe('confirming');
    
    // Verify bot shows continuation options
    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/add.*more.*service|continue.*service/i);
  });
});
```

### **2. Button-Based Actions**
```typescript
test('adds another service via button click', async () => {
  // Start with one service selected
  await startBookingFlow();
  const services = await fetchServices();
  const firstService = services[0];
  
  await simulateWebhookPost({ phone: TEST_PHONE, message: firstService.id });
  
  // Click "Add Another Service" button
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'add_another_service' 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify switched to selecting state
  const goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('selecting');
  
  // Verify bot shows filtered service list (excluding first service)
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(/select.*service/i);
  expect(botResponse).not.toMatch(new RegExp(firstService.name, 'i'));
});

test('continues with services via button click', async () => {
  // Start with one service selected
  await startBookingFlow();
  const services = await fetchServices();
  const firstService = services[0];
  
  await simulateWebhookPost({ phone: TEST_PHONE, message: firstService.id });
  
  // Click "Continue with Services" button
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'continue_with_services' 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify moved to next step
  const goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('completed');
  expect(goalData.selectedServices.length).toBe(1);
  
  // Verify bot confirmed continuation
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(/confirmed|continue|next/i);
});
```

### **3. Text-Based Button Simulation**
```typescript
test('handles text variations for adding another service', async () => {
  const textVariations = [
    'agregar otro',
    'añadir otro servicio',
    'quiero agregar más',
    'add another',
    'más servicios'
  ];
  
  for (const variation of textVariations) {
    await cleanup();
    
    // Start with one service selected
    await startBookingFlow();
    const services = await fetchServices();
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
    
    // Try text variation
    const resp = await simulateWebhookPost({ 
      phone: TEST_PHONE, 
      message: variation 
    });
    expect(JSON.stringify(resp)).toMatch(/success/i);
    
    // Should either switch to selecting state OR show helpful message
    const goalData = await getGoalData();
    const botResponse = await getLastBotMessage();
    
    if (goalData.addServicesState === 'selecting') {
      console.log(`✅ "${variation}" → Triggered service selection`);
      expect(botResponse).toMatch(/select.*service/i);
    } else {
      console.log(`📝 "${variation}" → Interpreted as conversation`);
      // Bot should still be helpful
      expect(botResponse).toMatch(/help|service|available/i);
    }
  }
});

test('handles text variations for continuing', async () => {
  const continueVariations = [
    'continuar',
    'seguir',
    'continúe',
    'continue',
    'next',
    'siguiente paso'
  ];
  
  for (const variation of continueVariations) {
    await cleanup();
    
    // Start with one service selected
    await startBookingFlow();
    const services = await fetchServices();
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
    
    // Try continue variation
    const resp = await simulateWebhookPost({ 
      phone: TEST_PHONE, 
      message: variation 
    });
    expect(JSON.stringify(resp)).toMatch(/success/i);
    
    const goalData = await getGoalData();
    const botResponse = await getLastBotMessage();
    
    if (goalData.addServicesState === 'completed') {
      console.log(`✅ "${variation}" → Triggered continuation`);
      expect(botResponse).toMatch(/confirmed|continue|next/i);
    } else {
      console.log(`📝 "${variation}" → Interpreted as conversation`);
      // Bot should still be helpful
      expect(botResponse).toMatch(/help|continue|service/i);
    }
  }
});
```

### **4. Multiple Service Selection**
```typescript
test('selects multiple services in sequence', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  expect(services.length).toBeGreaterThan(2); // Need at least 3 services
  
  // Select first service
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
  
  // Add second service
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[1].id });
  
  // Add third service
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[2].id });
  
  // Verify all services are selected
  const goalData = await getGoalData();
  expect(goalData.selectedServices.length).toBe(3);
  expect(goalData.selectedServices.map(s => s.id)).toContain(services[0].id);
  expect(goalData.selectedServices.map(s => s.id)).toContain(services[1].id);
  expect(goalData.selectedServices.map(s => s.id)).toContain(services[2].id);
  
  // Verify bot shows all selected services
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(new RegExp(services[0].name, 'i'));
  expect(botResponse).toMatch(new RegExp(services[1].name, 'i'));
  expect(botResponse).toMatch(new RegExp(services[2].name, 'i'));
  
  console.log('✅ Multiple services selected successfully');
});
```

### **5. Service Filtering Logic**
```typescript
test('correctly filters out already selected services', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  const firstService = services[0];
  const secondService = services[1];
  
  // Select first service
  await simulateWebhookPost({ phone: TEST_PHONE, message: firstService.id });
  
  // Try to add another service
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
  
  // Verify first service is not in available options
  const botResponse = await getLastBotMessage();
  expect(botResponse).not.toMatch(new RegExp(firstService.name, 'i'));
  expect(botResponse).toMatch(new RegExp(secondService.name, 'i'));
  
  // Try to select first service again (should not work)
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: firstService.id 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify first service was not added again
  const goalData = await getGoalData();
  const firstServiceCount = goalData.selectedServices.filter(s => s.id === firstService.id).length;
  expect(firstServiceCount).toBe(1); // Still only one instance
  
  console.log('✅ Service filtering working correctly');
});
```

### **6. Edge Case: All Services Selected**
```typescript
test('handles when all services are selected', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  
  // Select all services one by one
  for (let i = 0; i < services.length; i++) {
    if (i === 0) {
      // First service (from Step 1)
      await simulateWebhookPost({ phone: TEST_PHONE, message: services[i].id });
    } else {
      // Additional services
      await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
      await simulateWebhookPost({ phone: TEST_PHONE, message: services[i].id });
    }
  }
  
  // Try to add another service when all are selected
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'add_another_service' 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify system handles this gracefully
  const goalData = await getGoalData();
  expect(goalData.selectedServices.length).toBe(services.length);
  expect(goalData.addServicesState).toBe('confirming'); // Should stay in confirming
  
  // Verify bot shows helpful message
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(/all.*service|no.*more.*service|continue/i);
  
  // Try again to add service - should get same result
  const resp2 = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'add_another_service' 
  });
  expect(JSON.stringify(resp2)).toMatch(/success/i);
  
  const goalData2 = await getGoalData();
  expect(goalData2.selectedServices.length).toBe(services.length);
  expect(goalData2.addServicesState).toBe('confirming');
  
  console.log('✅ All services selected edge case handled');
});
```

### **7. FAQ Interruptions**
```typescript
test('handles FAQ interruption during service confirmation', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  
  // Select first service (now in confirmation state)
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
  
  // Ask FAQ question instead of choosing add/continue
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'cuánto cuesta el gel manicure?' 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify still in booking flow
  const goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('confirming');
  expect(goalData.selectedServices.length).toBe(1);
  
  // Verify bot answered FAQ
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(/gel.*manicure.*\$40|\$40.*gel.*manicure/i);
  
  console.log('✅ FAQ interruption handled during confirmation');
});

test('handles FAQ interruption during service selection', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  
  // Select first service and trigger add another
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
  
  // Now in selecting state - ask contextual FAQ
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'do you do hair and nails together?' 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify still in booking flow
  const goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('selecting');
  expect(goalData.selectedServices.length).toBe(1);
  
  // Verify bot provided helpful response
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(/hair.*nail|combination|together|separate/i);
  
  console.log('✅ FAQ interruption handled during selection');
});
```

### **8. Invalid Input Handling**
```typescript
test('handles invalid continuation choices', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  
  // Select first service (now in confirmation state)
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
  
  // Send invalid input
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'maybe tomorrow' 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify still in confirmation state
  const goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('confirming');
  
  // Verify bot provided helpful guidance
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(/add.*more.*service|continue.*service|help/i);
  
  console.log('✅ Invalid input handled with helpful guidance');
});

test('handles invalid service selection in selecting state', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  
  // Select first service and trigger add another
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
  
  // Try to select non-existent service
  const resp = await simulateWebhookPost({ 
    phone: TEST_PHONE, 
    message: 'car wash' 
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  
  // Verify service was not added
  const goalData = await getGoalData();
  expect(goalData.selectedServices.length).toBe(1);
  expect(goalData.addServicesState).toBe('selecting');
  
  // Verify bot provided helpful error
  const botResponse = await getLastBotMessage();
  expect(botResponse).toMatch(/couldn't find|not available|select.*option/i);
  
  console.log('✅ Invalid service selection handled');
});
```

### **9. State Transition Verification**
```typescript
test('verifies correct state transitions', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  
  // Step 1 → Step 2 (confirming)
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id });
  let goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('confirming');
  
  // confirming → selecting
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
  goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('selecting');
  
  // selecting → confirming (after service selection)
  await simulateWebhookPost({ phone: TEST_PHONE, message: services[1].id });
  goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('confirming');
  expect(goalData.selectedServices.length).toBe(2);
  
  // confirming → completed
  await simulateWebhookPost({ phone: TEST_PHONE, message: 'continue_with_services' });
  goalData = await getGoalData();
  expect(goalData.addServicesState).toBe('completed');
  
  console.log('✅ State transitions verified');
});
```

### **10. Service Data Integrity**
```typescript
test('maintains service data integrity across selections', async () => {
  await startBookingFlow();
  const services = await fetchServices();
  
  // Select services with different characteristics
  const serviceWithPrice = services.find(s => s.fixedPrice && s.durationEstimate);
  const mobileService = services.find(s => s.mobile);
  
  expect(serviceWithPrice).toBeDefined();
  
  // Select first service
  await simulateWebhookPost({ phone: TEST_PHONE, message: serviceWithPrice.id });
  
  // Add mobile service if exists
  if (mobileService) {
    await simulateWebhookPost({ phone: TEST_PHONE, message: 'add_another_service' });
    await simulateWebhookPost({ phone: TEST_PHONE, message: mobileService.id });
  }
  
  // Verify all service data is preserved
  const goalData = await getGoalData();
  const selectedService = goalData.selectedServices.find(s => s.id === serviceWithPrice.id);
  
  expect(selectedService).toBeDefined();
  expect(selectedService.name).toBe(serviceWithPrice.name);
  expect(selectedService.fixedPrice).toBe(serviceWithPrice.fixedPrice);
  expect(selectedService.durationEstimate).toBe(serviceWithPrice.durationEstimate);
  expect(selectedService.mobile).toBe(serviceWithPrice.mobile);
  
  if (mobileService) {
    const selectedMobile = goalData.selectedServices.find(s => s.id === mobileService.id);
    expect(selectedMobile.mobile).toBe(true);
  }
  
  console.log('✅ Service data integrity maintained');
});
```

## Implementation Requirements

### **File Structure:**
```
tests/integration/booking/steps/02-additional-services.test.ts
```

### **Required Imports:**
```typescript
import { simulateWebhookPost } from '../../utils';
import { ChatSession } from '@/lib/database/models/chat-session';
import { Service } from '@/lib/database/models/service';
import { UserContext } from '@/lib/database/models/user-context';
import { BOT_CONFIG } from '@/lib/bot-engine/types';
import { deleteChatSessionsForUser, deleteUserByWhatsapp } from '../../dbUtils';
import { TEST_CONFIG, getNormalizedTestPhone } from '../../../config/test-config';
import { 
  cleanup, 
  startBookingFlow, 
  getActiveSession, 
  fetchServices,
  getGoalData,
  getLastBotMessage,
  verifyServicesLoaded,
  verifyServiceSelected,
  verifyNoServiceSelected,
  verifyBotMentionsService,
  verifyBookingFlowActive,
  TEST_PHONE,
  BUSINESS_ID 
} from '../shared/booking-test-utils';
```

### **Test Configuration:**
```typescript
describe('Additional Services Selection Step - Real Bot Behavior', () => {
  beforeEach(async () => {
    await cleanup();
  });

  // Pre-test validation
  beforeAll(async () => {
    const services = await fetchServices();
    console.log(`✅ Found ${services.length} services for testing`);
    expect(services.length).toBeGreaterThan(2); // Need multiple services
  });

  // All tests here...
});
```

### **Critical Success Criteria:**
1. **✅ Reuses Step 1 components** - booking-test-utils.ts, helper functions
2. **✅ Tests both states** - confirming and selecting
3. **✅ Tests button functionality** - add_another_service, continue_with_services
4. **✅ Tests text variations** - "agregar otro", "continuar", "seguir"
5. **✅ Tests FAQ interruptions** - Contextual questions during flow
6. **✅ Tests edge cases** - All services selected, invalid inputs
7. **✅ Tests multiple services** - Sequential selection, filtering
8. **✅ Tests state transitions** - Proper flow between states
9. **✅ Real database integration** - No hardcoded values
10. **✅ Comprehensive logging** - Clear test progress indicators

This test suite will ensure the Additional Services Selection step works perfectly with real user interactions and prepares the foundation for Step 3 (Time/Date Selection). 