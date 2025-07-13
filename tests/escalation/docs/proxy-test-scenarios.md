# Proxy Test Scenarios 📞

This document outlines comprehensive test scenarios for the proxy escalation functionality, including edge cases and error conditions.

## 📋 Test Scenario Categories

### 1. **Basic Proxy Functionality**

#### 1.1 Proxy Session Creation
- **Scenario**: Customer escalates → Admin receives template → Proxy session starts
- **Expected**: Admin can send/receive messages through proxy
- **Test Files**: `integration/proxy-escalation.test.ts`

#### 1.2 Message Forwarding
- **Customer → Admin**: Customer messages forwarded to admin during proxy
- **Admin → Customer**: Admin messages forwarded to customer during proxy
- **Test Files**: `integration/proxy-escalation.test.ts`

#### 1.3 Proxy Session Termination
- **Button Click**: Admin clicks "Return control to bot" button
- **Text Command**: Admin types "return control to bot"
- **Expected**: Session ends, bot resumes control
- **Test Files**: `unit/proxy-session-manager.test.ts`

### 2. **Takeover Command Detection**

#### 2.1 Valid Commands (Case-insensitive)
```
✅ "return control to bot"
✅ "Return control to bot"
✅ "RETURN CONTROL TO BOT"
✅ "return to bot"
✅ "back to bot"
✅ "end proxy"
✅ "stop proxy"
✅ "bot takeover"
✅ "proxy end"
✅ "proxy stop"
✅ "end session"
✅ "stop session"
```

#### 2.2 Invalid Commands
```
❌ "hello world"
❌ "return control"
❌ "bot help"
❌ "end session please"
❌ "control bot"
```

#### 2.3 Button Commands
```
✅ Button payload: "return_control_to_bot"
✅ Button payload: "Return control to bot"
❌ Button payload: "invalid_button"
```

### 3. **Edge Cases & Error Handling**

#### 3.1 Concurrent Proxy Sessions
- **Scenario**: Multiple customers escalate simultaneously
- **Expected**: Each customer gets independent proxy session
- **Admin Behavior**: Admin can handle one customer at a time
- **Test Files**: `integration/proxy-escalation.test.ts`

#### 3.2 Session Timeout
- **Scenario**: Proxy session exceeds 24-hour limit
- **Expected**: Session automatically terminated
- **Test Files**: `unit/proxy-session-manager.test.ts`

#### 3.3 Admin Unavailability
- **Scenario**: Admin doesn't respond to escalation
- **Expected**: Escalation notification remains pending
- **Fallback**: Customer can still use bot

#### 3.4 Database Errors
- **Connection Failure**: Database connection drops during proxy
- **Expected**: Graceful degradation, error logged
- **Test Files**: `integration/proxy-escalation.test.ts`

#### 3.5 WhatsApp API Failures
- **Template Send Failure**: Template message fails to send
- **Message Forward Failure**: Message forwarding fails
- **Expected**: Error logged, user notified appropriately
- **Test Files**: `integration/proxy-escalation.test.ts`

### 4. **WhatsApp Integration Scenarios**

#### 4.1 Message Types
- **Text Messages**: Basic text forwarding
- **Media Messages**: Images, videos, documents
- **Voice Messages**: Audio forwarding
- **Location Messages**: GPS coordinates
- **Button Responses**: Interactive button clicks

#### 4.2 Message Context
- **Reply Messages**: Messages replying to previous messages
- **Forwarded Messages**: Messages forwarded from other chats
- **Quoted Messages**: Messages with quoted text

#### 4.3 Business Phone Number ID
- **Valid ID**: Messages process correctly
- **Invalid ID**: Error handling and logging
- **Multiple IDs**: Business with multiple WhatsApp numbers

### 5. **User Role & Permission Scenarios**

#### 5.1 Admin Detection
- **Valid Admin**: Phone number matches admin in database
- **Invalid Admin**: Non-admin tries to end proxy session
- **Multiple Admins**: Different admins for same business
- **Test Files**: `unit/proxy-session-manager.test.ts`

#### 5.2 Phone Number Normalization
```
✅ "+61452490450" → "61452490450"
✅ "61452490450" → "61452490450"  
✅ "0452490450" → "61452490450"
```

#### 5.3 Customer Identification
- **Existing Customer**: Known customer escalates
- **New Customer**: Unknown customer escalates
- **Multiple Customers**: Same admin handles multiple customers

### 6. **Session Lifecycle Scenarios**

#### 6.1 Normal Flow
```
1. Customer escalates
2. Admin receives template
3. Admin responds (proxy starts)
4. Conversation continues
5. Admin ends proxy
6. Bot resumes control
```

#### 6.2 Interrupted Flow
```
1. Customer escalates
2. Admin receives template
3. Admin doesn't respond
4. Customer continues with bot
5. Admin responds later (proxy starts)
```

#### 6.3 Premature Termination
```
1. Customer escalates
2. Admin receives template
3. Admin immediately ends proxy
4. Customer continues with bot
```

### 7. **Performance & Load Testing**

#### 7.1 High Message Volume
- **Scenario**: Rapid message exchange during proxy
- **Expected**: All messages forwarded correctly
- **Performance**: < 2 second message delivery

#### 7.2 Concurrent Sessions
- **Scenario**: 10+ concurrent proxy sessions
- **Expected**: No message mix-up between sessions
- **Performance**: No degradation in response time

#### 7.3 Database Load
- **Scenario**: High database query load during proxy
- **Expected**: Efficient query execution
- **Performance**: < 500ms database response time

### 8. **Language & Localization**

#### 8.1 Multi-language Support
- **Spanish**: "Devolver control al bot"
- **English**: "Return control to bot"
- **Expected**: Commands work in user's language

#### 8.2 Template Messages
- **Admin Template**: Sent in admin's language
- **Customer Messages**: Forwarded as-is
- **System Messages**: Sent in appropriate language

### 9. **Security & Validation**

#### 9.1 Message Validation
- **Malicious Content**: HTML/script injection attempts
- **Large Messages**: Messages exceeding size limits
- **Invalid Characters**: Special characters handling

#### 9.2 Session Security
- **Session Hijacking**: Prevent unauthorized access
- **Data Leakage**: Ensure messages only go to intended recipients
- **Audit Trail**: Log all proxy activities

### 10. **Integration Points**

#### 10.1 Bot Engine Integration
- **Escalation Detection**: Bot detects escalation need
- **Proxy Handoff**: Smooth transition to proxy mode
- **Bot Resume**: Clean handoff back to bot

#### 10.2 Notification System
- **Admin Notifications**: Real-time escalation alerts
- **Customer Notifications**: Proxy status updates
- **System Notifications**: Error and status alerts

#### 10.3 Database Integration
- **Session Storage**: Proxy session persistence
- **Message Logging**: Conversation history
- **User Management**: Admin and customer records

---

## 🧪 Test Implementation Guidelines

### Test Data Management
- Use consistent test phone numbers
- Clean up test data after each test
- Mock external API calls appropriately

### Test Isolation
- Each test should be independent
- No shared state between tests
- Proper setup and teardown

### Error Simulation
- Mock database failures
- Simulate API timeouts
- Test rate limiting scenarios

### Performance Testing
- Measure response times
- Test with realistic data volumes
- Monitor resource usage

---

## 📊 Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| Proxy Session Manager | 95% |
| Message Router | 90% |
| Escalation Handler | 85% |
| Admin Detection | 95% |
| Message Forwarding | 90% |
| Error Handling | 80% |

---

## 🔍 Common Test Patterns

### Message Builder Pattern
```typescript
const message = ProxyMessageBuilder.createEndProxyMessage(
  adminPhone,
  'button'
);
```

### Expectation Helpers
```typescript
ProxyExpectations.expectMessageForwarded(result, 'Admin→Customer');
ProxyExpectations.expectProxyEnded(result, true);
```

### Database Cleanup
```typescript
afterEach(async () => {
  await ProxyTestDb.cleanupTestProxySessions();
});
```

---

## 🚨 Critical Test Scenarios

### Must-Pass Tests
1. **Basic proxy creation and termination**
2. **Message forwarding in both directions**
3. **Takeover command detection**
4. **Admin permission validation**
5. **Database error handling**

### High-Risk Scenarios
1. **Concurrent proxy sessions**
2. **Session timeout handling**
3. **WhatsApp API failures**
4. **Message forwarding failures**
5. **Phone number normalization**

---

For implementation details, see the test files in the `tests/escalation/` directory. 