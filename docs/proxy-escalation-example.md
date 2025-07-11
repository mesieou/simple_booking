# Proxy Escalation System with Conversation History

## Overview
The proxy escalation system allows admins to communicate with customers through the bot, providing conversation history context and seamless handoff.

## Complete Flow Example

### 1. Customer Escalation Request
```
Customer: "I want to speak to a human"
Bot: "Let me connect you with our team..."
[Bot triggers escalation]
```

### 2. Admin Receives Escalation (Single Comprehensive Message)

**Template with Header and Button:**
```
Header: Customer {{1}} needs help!

Body:
📝 Recent Chat:
{{2}}

💬 Current Message:
"{{3}}"

✅ Reply here to chat directly with customer

Button: "Return control to bot"
```

**Example rendered:**
```
Header: Customer John Doe needs help!

📝 Recent Chat:
🤖 Bot: "I'd be happy to help you book a manicure. What time would you prefer?" (1m ago)
👤 Customer: "Look at my broken nail" 📎 (3m ago)
👤 Customer: "Hi, I want to book a manicure for tomorrow" (5m ago)

💬 Current Message:
"I want to speak to a human"

✅ Reply here to chat directly with customer

[Return control to bot] ← Button
```

**If there are media attachments, admin also receives:**
```
📎 RECENT ATTACHMENTS:

👤 John Doe sent (3m ago):
📎 IMAGE: https://media.whatsapp.com/v1/media/abc123
💬 "Look at my broken nail"
```

### 3. Admin Response
```
Admin: "Hi John! 👋 I'm here to help you with your manicure booking. What time works best for you tomorrow?"
```

### 4. Customer Receives Admin Message
```
Customer receives: "Hi John! 👋 I'm here to help you with your manicure booking. What time works best for you tomorrow?"
[Customer doesn't see it's from admin - seamless experience]
```

### 5. Customer Response
```
Customer: "How about 2 PM?"
```

### 6. Admin Receives Customer Message
```
Admin receives: "👤 John Doe said: 'How about 2 PM?'"
```

### 7. Conversation Continues
```
Admin: "Perfect! I can book you for 2 PM tomorrow. Which service would you like?"
Customer: "Just a basic manicure please"
Admin: "Great! You're all set for 2 PM tomorrow. You'll receive a confirmation shortly."
```

### 8. Admin Ends Proxy Mode
```
Admin clicks: [Return control to bot] button
```

### 9. Bot Resumes Control
```
Admin receives: "🔄 Proxy mode ended. Bot has resumed control of the conversation."
Bot to Customer: "Thank you for your patience. Your appointment is confirmed for tomorrow at 2 PM."
```

## Key Features

### ✅ Comprehensive Template Message
- Opens 24-hour messaging window
- Works even if admin hasn't messaged in 24+ hours
- Includes conversation history directly in template (up to 4 messages)
- Shows customer name, context, and current issue in single message
- Compact format fits easily within 1024 character limit

### ✅ Rich Conversation Context
- Shows last 4 messages with timestamps
- Includes sender identification (Customer/Bot)
- Handles both text and interactive messages
- **Includes media attachments** (images, videos, documents)
- Shows 📎 indicator in template when media is present
- Sends actual media files as follow-up messages
- Automatically truncates long messages for readability

### ✅ Seamless Proxy
- Customer doesn't know they're talking to different person
- Admin messages go directly to customer
- Customer messages are forwarded to admin with identification

### ✅ Easy Handoff
- **One-click button** to end proxy mode (no typing needed!)
- Fallback "skedy-continue" text command still works
- Bot automatically resumes conversation
- Clean transition back to automated flow

## Testing the System

### Test Escalation Template
```bash
curl -X POST http://localhost:3000/api/test-proxy-escalation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send_escalation_template",
    "adminPhone": "61452490450",
    "customerName": "John Doe",
    "customerMessage": "I want to speak to a human",
    "businessPhoneNumberId": "680108705183414",
    "chatSessionId": "real-session-id",
    "language": "en"
  }'
```

### Test Conversation History
```bash
curl -X POST http://localhost:3000/api/test-proxy-escalation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_conversation_history",
    "chatSessionId": "real-session-id",
    "limit": 3
  }'
```

### Test Admin Message
```bash
curl -X POST http://localhost:3000/api/test-proxy-escalation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "simulate_admin_message",
    "adminPhone": "61452490450",
    "message": "Hi, I'm here to help you!",
    "businessPhoneNumberId": "680108705183414"
  }'
```

### Test Button Press (Takeover)
```bash
curl -X POST http://localhost:3000/api/test-proxy-escalation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "simulate_admin_message",
    "adminPhone": "61452490450",
    "message": "BUTTON_TEST",
    "businessPhoneNumberId": "680108705183414"
  }'
```

### Test Customer Message
```bash
curl -X POST http://localhost:3000/api/test-proxy-escalation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "simulate_customer_message",
    "senderId": "61987654321",
    "message": "Thank you for your help!",
    "businessPhoneNumberId": "680108705183414"
  }'
```

### Test Media Attachments
```bash
curl -X POST http://localhost:3000/api/test-proxy-escalation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_media_attachments",
    "chatSessionId": "real-session-id"
  }'
```

## Benefits

1. **Solves 24-hour WhatsApp limitation** - Template messages work even after 24 hours
2. **Provides context** - Admin sees conversation history
3. **Seamless experience** - Customer doesn't notice handoff
4. **Easy management** - Simple commands for admin
5. **Automatic fallback** - Bot resumes after admin ends session

## Template Configuration (Meta Business Manager)

**Create this template in Meta Business Manager:**

```
Template Name: customer_needs_help (prod) / header_customer_needs_help (dev)
Category: UTILITY
Language: English (US)

Header: Customer {{1}} needs help!

Body:
📝 Recent Chat:
{{2}}

💬 Current Message:
"{{3}}"

✅ Reply here to chat directly with customer

Button Type: Quick Reply
Button Text: Return control to bot
Button ID: return_control_to_bot
```

**Sample Variables for Meta Review:**
- {{1}}: John Doe
- {{2}}: 🤖 Bot: "I'd be happy to help you book a manicure. What time would you prefer?" (1m ago)
👤 Customer: "Look at my broken nail" 📎 (3m ago)

**Character count:** ~180 characters (fixed text) + parameters = well under 1024 limit!

## Database Schema Addition

Add these columns to your notifications table:
```sql
-- Add missing columns for proxy escalation (camelCase naming)
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "notificationType" TEXT DEFAULT 'escalation';

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "priorityLevel" TEXT DEFAULT 'medium';

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "languageCode" TEXT DEFAULT 'en';

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "proxySessionData" JSONB DEFAULT NULL;
```

## Files Created

1. `lib/bot-engine/escalation/proxy-escalation-handler.ts` - Main escalation logic
2. `lib/bot-engine/escalation/proxy-communication-router.ts` - Message routing
3. `lib/database/models/notification-proxy-extensions.ts` - Database extensions
4. `lib/bot-engine/channels/whatsapp/whatsapp-template-sender.ts` - Template sender
5. `app/api/test-proxy-escalation/route.ts` - Test endpoint 