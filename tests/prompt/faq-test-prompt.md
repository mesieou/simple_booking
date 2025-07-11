# FAQ System Integration Test Generation - Beauty Asiul

## Business Information
**Business ID:** ef97961f-18ad-4304-9d9d-6cd38308d65f
**Business Name:** Beauty Asiul
**Owner:** Luisa Bernal

## Business Details
- **Address:** Apt 11, 9 Dryburgh st, West Melbourne, VIC 3003
- **Phone:** +61473164581
- **WhatsApp:** +15551890570
- **Email:** luisa.bernal7826@gmail.com
- **Timezone:** Australia/Sydney
- **Deposit Required:** 50%
- **Preferred Payment:** Cash
- **Mobile Services:** NO (does not provide mobile services)

## Available Services (12 services)
1. **Basic Manicure** - $30 (35 min) - Classic manicure treatment
2. **Express Manicure** - $35 (35 min) - Quick manicure treatment
3. **Gel Manicure** - $40 (60 min) - Manicure with long-lasting gel polish
4. **Basic Pedicure** - $45 (35 min) - Classic pedicure treatment
5. **Gel Pedicure** - $50 (60 min) - Pedicure with long-lasting gel polish
6. **Press on Manicure** - $80 (60 min) - Professional press-on nail application
7. **Ladies Haircut** - $50 (60 min) - Professional ladies haircut and styling
8. **Hair Styling** - $50 (45 min) - Professional hair styling service
9. **Blow Dry** - $35 (30 min) - Professional blow dry service
10. **Braids** - $30 (90 min) - Professional braiding service
11. **Waves** - $30 (45 min) - Professional wave styling
12. **Treatments** - $60 (60 min) - Hair treatment services

## Key Business Policies (from real FAQ documents)
- **Location:** Works from apartment, NOT a public salon
- **Same-day bookings:** May accept if available
- **Deposit:** 50% required, refundable with 24h notice
- **Payment:** Cash preferred/required
- **Mobile services:** NO - only works from North Melbourne location
- **Cancellation:** 24h advance notice required to retain deposit
- **Flexibility:** Tries to accommodate delays/changes when possible

## Test Approach - REALISTIC INTEGRATION TESTING

### **NO MOCKING - Use Real System:**
- ✅ Use `simulateWebhookPost` like in `newUserFlow.test.ts`
- ✅ Let RAGfunction use real embeddings and documents
- ✅ Verify bot responses contain real data from database
- ✅ Test complete webhook → parsing → FAQ → response pipeline

### **Follow newUserFlow.test.ts Pattern:**
```typescript
// Use simulateWebhookPost for realistic WhatsApp message simulation
const resp = await simulateWebhookPost({ 
  phone: TEST_PHONE, 
  message: 'customer question here' 
});

// Verify webhook success
expect(JSON.stringify(resp)).toMatch(/success/i);

// Get actual bot response from database
const session = await ChatSession.getActiveByChannelUserId(
  'whatsapp',
  getNormalizedTestPhone(),
  BOT_CONFIG.SESSION_TIMEOUT_HOURS
);

// Verify bot response content
const botResponse = session.allMessages[session.allMessages.length - 1].content;
expect(botResponse).toMatch(/expected content/i);
```

## Test Categories - UNPREDICTABLE CUSTOMER SCENARIOS

### 1. **Realistic Service Inquiries (Customers ask weird ways)**
```typescript
// Test various ways customers ask about same service
test('gel manicure inquiries - multiple variations', async () => {
  const variations = [
    'Do you do gel manicures?',
    'gel nails?',
    'shellac manicure available?',
    'how much for gel polish?',
    'gel manicure price?',
    'do u do gel stuff?',
    'gel mani cost?'
  ];
  
  for (const question of variations) {
    const resp = await simulateWebhookPost({ phone: TEST_PHONE, message: question });
    // Verify ALL variations return gel manicure info: $40, 60 minutes
    // Bot should understand and respond with same service info
  }
});
```

### 2. **Tricky/Confusing Questions (Real customer behavior)**
```typescript
// Test confusing/unclear questions
test('handles confusing customer questions', async () => {
  const confusingQuestions = [
    'what can you do?', // Vague service inquiry
    'prices?', // One word question
    'available tomorrow?', // Booking attempt in FAQ
    'how much everything?', // Pricing for all services
    'do you do nails and hair?', // Multiple services
    'whats cheapest?', // Price comparison
    'can i bring my friend?', // Policy question
    'cash only?', // Payment inquiry
    'where exactly?', // Location details
    'are you open?', // Hours inquiry
  ];
  
  // Each should get appropriate response from real FAQ system
});
```

### 3. **Services NOT Available (Critical negative testing)**
```typescript
test('clearly states unavailable services', async () => {
  const unavailableServices = [
    'do you do massages?',
    'facial treatments?',
    'eyebrow threading?',
    'mens haircuts?',
    'acrylic nails?',
    'waxing services?',
    'makeup application?',
    'eyelash extensions?',
    'tattoo removal?',
    'piercing?'
  ];
  
  // Bot should politely decline and maybe suggest available alternatives
  // Should NOT hallucinate services that don't exist
});
```

### 4. **Mobile Service Confusion (Common customer assumption)**
```typescript
test('clearly explains NO mobile services', async () => {
  const mobileQuestions = [
    'can you come to my house?',
    'do you do mobile?',
    'home visit available?',
    'can you travel to me?',
    'mobile service?',
    'do you come to hotels?',
    'outcall service?',
    'can you do it at my place?'
  ];
  
  // Bot should clearly state NO mobile services
  // Should provide correct studio address
  // Should explain she only works from North Melbourne
});
```

### 5. **Complex Policy Questions (Real customer concerns)**
```typescript
test('explains business policies accurately', async () => {
  const policyQuestions = [
    'what if i cancel?',
    'deposit required?',
    'do you take card?',
    'cash only?',
    'can i reschedule?',
    'what if im late?',
    'do you do walk ins?',
    'same day booking?',
    'how far in advance?',
    'what if you cancel?',
    'deposit refundable?'
  ];
  
  // Should provide accurate policy info from documents
  // 50% deposit, 24h cancellation policy, cash preferred
});
```

### 6. **Location/Contact Confusion (Customer navigation issues)**
```typescript
test('provides clear location and contact info', async () => {
  const locationQuestions = [
    'where are you located?',
    'whats your address?',
    'how do i find you?',
    'what apartment?',
    'parking available?',
    'public transport?',
    'exact address?',
    'phone number?',
    'how to contact?',
    'whatsapp number?'
  ];
  
  // Should provide correct address: Apt 11, 9 Dryburgh st, West Melbourne
  // Should provide correct contact info
});
```

### 7. **Mixed Language/Typos (Real customer messages)**
```typescript
test('handles typos and mixed language', async () => {
  const messyQuestions = [
    'manicre price?', // Typo
    'gel mani cuanto cuesta?', // Mixed language
    'haicut tomorrow?', // Typo
    'braids availble?', // Typo
    'how much for nales?', // Typo
    'tratamientos de cabello?', // Spanish
    'precio manicure?', // Spanish
  ];
  
  // Bot should still understand and respond appropriately
});
```

## Critical Validations - REAL DATA VERIFICATION

### **Verify Real Database Content:**
```typescript
// Service information must come from actual services table
expect(botResponse).toMatch(/40/); // Real price for gel manicure
expect(botResponse).toMatch(/60.*minutes/i); // Real duration
expect(botResponse).toMatch(/Beauty Asiul/i); // Real business name
expect(botResponse).toMatch(/West Melbourne/i); // Real location
expect(botResponse).toMatch(/cash/i); // Real payment preference
expect(botResponse).toMatch(/50.*deposit/i); // Real deposit policy
```

### **Verify System Integration:**
1. **RAGfunction Integration** - Responses use real embeddings
2. **Services Table** - Pricing/duration from actual database
3. **Documents Table** - Policies from real FAQ documents
4. **Business Table** - Contact info from real business record
5. **Complete Pipeline** - Webhook → Parser → FAQ → Response

### **Test Structure:**
```typescript
describe('FAQ System Integration Tests - Beauty Asiul', () => {
  beforeAll(async () => {
    await cleanup(); // Clean test data
  });

  afterAll(async () => {
    await cleanup();
  });

  // Use TEST_CONFIG for consistency
  const TEST_PHONE = TEST_CONFIG.TEST_PHONE_NUMBER;
  const BUSINESS_ID = TEST_CONFIG.BUSINESS_ID; // Beauty Asiul ID

  describe('Service Availability - Multiple Variations', () => {
    // Test each service with multiple question variations
  });

  describe('Service Unavailability - Clear Rejections', () => {
    // Test services NOT offered
  });

  describe('Mobile Service Confusion', () => {
    // Test mobile service questions
  });

  describe('Business Policies', () => {
    // Test deposit, payment, cancellation policies
  });

  describe('Location and Contact', () => {
    // Test address, phone, email questions
  });

  describe('Complex Customer Behavior', () => {
    // Test typos, mixed language, confusing questions
  });
});
```

## Implementation Requirements

1. **Use Real Testing Infrastructure:**
   - Import from `tests/integration/utils`
   - Use `simulateWebhookPost` function
   - Follow `newUserFlow.test.ts` patterns

2. **Verify Real Responses:**
   - Check actual bot message content
   - Verify real prices, durations, policies
   - Ensure no hallucinated information

3. **Test Customer Unpredictability:**
   - Multiple ways to ask same question
   - Typos and informal language
   - Mixed languages (English/Spanish)
   - Vague or confusing questions

4. **Comprehensive Coverage:**
   - All 12 services (positive cases)
   - Common unavailable services (negative cases)
   - All business policies
   - Location and contact information
   - Edge cases and confusing scenarios

Generate comprehensive integration tests that simulate real customer interactions and verify the FAQ system responds accurately using actual database content. 