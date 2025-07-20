# 🎯 Template-Based Notification System Examples

This document shows how to use the new unified scalable notification system.

## 🚀 **Basic Usage**

### **1. Booking Notifications**

```typescript
import { ScalableNotificationService } from '@/lib/bot-engine/services/scalable-notification-service';

// Example booking confirmation with customer-style formatting
const bookingDetails = {
  bookingId: 'BK123456',
  customerName: 'Jane Doe',
  customerPhone: '+1234567890',
  serviceName: 'Hair Cut & Color',
  servicesDisplay: 'Hair Cut & Color',
  isMultiService: false,
  formattedDate: 'March 15, 2025',
  formattedTime: '2:30 PM',
  location: 'Main Street Salon',
  totalCost: 125.00,
  travelCost: 10.00,
  amountPaid: 50.00,
  amountOwed: 75.00,
  paymentMethod: 'cash/card',
  providerContactInfo: '+1234567890 • salon@example.com'
};

// Send notification - automatically uses templates + detailed messages
const notificationService = new ScalableNotificationService();
await notificationService.sendBookingNotification(
  'business-id-here',
  bookingDetails
);
```

**Result:**
- **WhatsApp Template:** `🎉 New booking for Jane Doe! 📋 Booking BK123456 confirmed for Hair Cut & Color on March 15, 2025 at 2:30 PM. Total: $125.00`
- **Detailed Message:** Customer-style confirmation with all payment details, contact info, etc.
- **Email:** HTML formatted with all details
- **SMS:** Condensed version for reliability

### **2. Negative Feedback Notifications**

```typescript
import { ScalableNotificationService } from '@/lib/bot-engine/services/scalable-notification-service';

// Example feedback alert
const feedbackDetails = {
  customerName: 'John Smith',
  feedbackText: 'The service was delayed and I was not notified',
  businessName: 'Beauty Salon XYZ',
  timestamp: 'March 15, 2025'
};

// Send template-based notification (only to super admins)
const notificationService = new ScalableNotificationService();
await notificationService.sendFeedbackNotification(
  'business-id-here',
  feedbackDetails
);
```

**WhatsApp Template Used:** `negative_feedback_alert`
- **Header:** `⚠️ Negative feedback received`
- **Body:** `Customer John Smith from Beauty Salon XYZ left negative feedback on March 15, 2025: "The service was delayed and I was not notified"`

## 🎯 **Advanced Multi-Provider Usage**

### **1. Provider-Specific Delivery**

```typescript
const notificationService = new ScalableNotificationService();

// One call, multiple providers automatically selected
await notificationService.sendNotification({
  type: 'booking',
  businessId: 'business-id',
  content: {
    title: "🎉 New Booking!",
    message: customerStyleMessage, // Detailed customer-format message
    data: bookingDetails // Provider-agnostic data for templates
  }
});

// Results automatically:
// 📱 Business Admin → WhatsApp template + detailed fallback
// 📧 Super Admin → HTML email + template backup
// 💬 Teams → Adaptive card (if configured)
// 📟 SMS → Plain text (if needed)
```

### **2. Force Specific Providers**

```typescript
// Send only via email and SMS (skip WhatsApp)
await notificationService.sendNotification({
  type: 'system',
  businessId: 'business-id',
  content: feedbackContent,
  preferredProviders: ['email', 'sms'] // Skip WhatsApp templates
});
```

### **3. Custom Recipients with Preferences**

```typescript
const customRecipients = [
  {
    userId: '1',
    phoneNumber: '+1234567890',
    email: 'admin@business.com',
    preferredChannel: 'whatsapp', // Gets WhatsApp template
    name: 'Business Admin',
    isBusinessAdmin: true,
    isSuperAdmin: false
  },
  {
    userId: '2', 
    email: 'super@company.com',
    preferredChannel: 'email', // Gets HTML email
    name: 'Super Admin',
    isBusinessAdmin: false,
    isSuperAdmin: true
  }
];

await notificationService.sendNotification({
  type: 'booking',
  businessId: 'business-id',
  content: content,
  recipients: customRecipients
});
```

## 🔧 **Provider Configuration**

### **Check Provider Status**

```typescript
const notificationService = new ScalableNotificationService();

// Get all provider info
const providerInfo = notificationService.getProviderInfo();
console.log(providerInfo);
// Output:
// {
//   whatsapp: {
//     templatesSupported: ['booking', 'system', 'escalation'],
//     requiresBusinessPhoneId: true,
//     maxMessageLength: 4096
//   },
//   sms: {
//     templatesSupported: [], // No templates needed
//     maxMessageLength: 1600
//   },
//   email: {
//     templatesSupported: ['booking', 'system'],
//     supportsHtml: true
//   }
// }

// Health check all providers
const health = await notificationService.healthCheck();
console.log(health);
// Output:
// {
//   whatsapp: true,  // Templates approved and credentials valid
//   sms: false,      // Missing Twilio credentials
//   email: true      // SendGrid configured
// }
```

## 🎨 **Customer-Style Message Format**

Admins now receive the **exact same detailed format** that customers see:

```
🎉 Jane Doe, booking confirmed!

💼 Service:
   Hair Cut & Color

🚗 Travel: $10.00
💰 Total Cost: $125.00

📅 Date: March 15, 2025
⏰ Time: 2:30 PM
📍 Location: Main Street Salon

💳 Payment Summary:
   • Paid: $50.00
   • Balance Due: $75.00
   • Payment Method: cash/card

📞 Customer Contact:
   +1234567890

📞 Provider Contact:
   +1234567890 • salon@example.com

📄 Booking ID: BK123456

New booking confirmed and ready to serve!
```

## 🆚 **Old vs New System**

### **❌ Old System Problems:**
```typescript
// OLD: WhatsApp-centric and hard to scale
import { GenericNotificationService } from './generic-notification-service';

await GenericNotificationService.sendNotification({
  useTemplatesOnly: true // Forces templates on ALL providers
});
```

### **✅ New Scalable System:**
```typescript
// NEW: Provider-agnostic and easily scalable
import { ScalableNotificationService } from './scalable-notification-service';

const service = new ScalableNotificationService();
// Automatically handles templates only where needed
await service.sendBookingNotification(businessId, details);
```

## 🧪 **Testing**

### **Test Template Notifications**

```typescript
import { ScalableNotificationService } from '@/lib/bot-engine/services/scalable-notification-service';

// Test booking notification
const service = new ScalableNotificationService();
await service.sendBookingNotification('test-business-id', {
  bookingId: 'TEST123',
  customerName: 'Test Customer',
  serviceName: 'Test Service',
  formattedDate: 'Today',
  formattedTime: 'Now',
  totalCost: 99.99
});

// Test feedback notification  
await service.sendFeedbackNotification('test-business-id', {
  customerName: 'Test Customer',
  feedbackText: 'Test feedback',
  businessName: 'Test Business'
});
```

## 🔍 **Debugging**

### **Template Validation**

```typescript
// Check if templates are properly configured
const whatsappProvider = new (await import('./notification-providers/whatsapp-provider')).WhatsAppProvider();
const config = whatsappProvider.getConfiguration();
console.log('WhatsApp provider config:', config);

// Check health
const isHealthy = await whatsappProvider.healthCheck();
console.log('WhatsApp provider healthy:', isHealthy);
```

### **Debug Specific Notifications**

```typescript
// Enable detailed logging
process.env.DEBUG = '*notification*';

const service = new ScalableNotificationService();
await service.sendBookingNotification(businessId, details);
// Will show detailed logs of provider selection, template calls, etc.
```

## 🎉 **Benefits Summary**

### **✅ Scalable Architecture**
- Easy to add new providers (Push, Slack, Teams, etc.)
- WhatsApp templates isolated to WhatsApp only
- Each provider handles its own requirements

### **✅ Customer-Parity**
- Admins get the same detailed info customers see
- Consistent formatting across all channels
- Professional presentation

### **✅ Reliable Delivery**
- Multi-provider fallback
- Template + regular message backup
- Health monitoring and debugging

### **✅ Developer Friendly**
- Simple API for common use cases
- Detailed debugging information
- Easy testing and validation

---

**The new system ensures admins receive the same high-quality, detailed booking confirmations that customers do, while maintaining the scalability to add any messaging provider without affecting existing ones!** 🚀 