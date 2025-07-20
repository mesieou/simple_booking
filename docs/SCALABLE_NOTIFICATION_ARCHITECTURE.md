# 🏗️ Scalable Notification Architecture

This document explains the new provider-agnostic notification system that easily scales to any messaging provider without being affected by provider-specific requirements.

## 🚨 **Problem with Old Architecture**

**❌ WhatsApp-centric design:**
```typescript
// OLD: Forces all providers to use templates
const content = {
  templateData: {...} // WhatsApp-specific
};

await GenericNotificationService.sendNotification({
  useTemplatesOnly: true // Forces templates on ALL providers
});
```

**❌ Tight coupling:**
```typescript
// OLD: Generic service imports WhatsApp classes
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
```

## ✅ **New Scalable Architecture**

### **1. Provider-Agnostic Interface**

```typescript
// Each provider handles its own requirements
export abstract class BaseNotificationProvider {
  abstract sendNotification(
    type: NotificationType,
    recipient: NotificationRecipient,
    content: NotificationContent, // Generic content
    businessContext: BusinessContext
  ): Promise<DeliveryResult>;
  
  abstract canHandle(recipient: NotificationRecipient): boolean;
}
```

### **2. Provider-Specific Implementations**

**WhatsApp Provider** (Templates isolated):
```typescript
export class WhatsAppProvider extends BaseNotificationProvider {
  private templateConfig = new Map([
    ['booking', {
      templateName: 'booking_confirmation',
      requiresTemplate: true,
      headerParams: (data) => [data.customerName],
      bodyParams: (data) => [data.bookingId, data.serviceName, ...]
    }]
  ]);

  async sendNotification(type, recipient, content, context) {
    // WhatsApp handles templates internally
    if (this.templateConfig.has(type)) {
      return await this.sendTemplate(...);
    }
    return await this.sendRegularMessage(...);
  }
}
```

**SMS Provider** (No templates needed):
```typescript
export class SMSProvider extends BaseNotificationProvider {
  async sendNotification(type, recipient, content, context) {
    // Simple text formatting - no templates!
    const smsText = this.formatSMSMessage(content);
    return await this.sendSMS(recipient.phoneNumber, smsText);
  }
}
```

**Email Provider** (HTML templates):
```typescript
export class EmailProvider extends BaseNotificationProvider {
  async sendNotification(type, recipient, content, context) {
    // Different template system - HTML emails
    const html = this.formatEmailHTML(content);
    return await this.sendEmail(recipient.email, html);
  }
}
```

## 🚀 **Easy to Add New Providers**

### **Adding Push Notifications:**

```typescript
export class PushProvider extends BaseNotificationProvider {
  readonly providerName = 'push';
  readonly supportedChannels = ['push'];

  canHandle(recipient: NotificationRecipient): boolean {
    return !!(recipient.deviceToken && recipient.preferredChannel === 'push');
  }

  async sendNotification(type, recipient, content, context) {
    // Push notifications have their own format
    const pushPayload = {
      title: content.title,
      body: content.message,
      badge: 1,
      sound: 'default'
    };
    
    return await this.sendPushNotification(recipient.deviceToken, pushPayload);
  }
}

// Register the new provider
const notificationService = new ScalableNotificationService();
notificationService.registerProvider(new PushProvider());
```

### **Adding Slack Integration:**

```typescript
export class SlackProvider extends BaseNotificationProvider {
  readonly providerName = 'slack';
  readonly supportedChannels = ['slack'];

  async sendNotification(type, recipient, content, context) {
    // Slack-specific formatting
    const slackMessage = {
      text: content.title,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: content.message }
        }
      ]
    };
    
    return await this.sendSlackMessage(recipient.slackChannel, slackMessage);
  }
}
```

## 📱 **Usage Examples**

### **1. Simple Usage** (Provider-agnostic)

```typescript
import { ScalableNotificationService } from '@/lib/bot-engine/services/scalable-notification-service';

const notificationService = new ScalableNotificationService();

// Send booking notification - automatically routes to best provider for each recipient
await notificationService.sendBookingNotification('business-id', {
  bookingId: 'BK123',
  customerName: 'John Doe',
  serviceName: 'Hair Cut',
  formattedDate: 'March 15, 2025',
  formattedTime: '2:30 PM',
  totalCost: 75.00
});
```

### **2. Multi-Provider Delivery**

```typescript
// Business admin gets WhatsApp (templates)
// Super admin gets Email (HTML)
// Customer gets SMS (plain text)

await notificationService.sendNotification({
  type: 'booking',
  businessId: 'business-id',
  content: {
    title: "🎉 New Booking!",
    message: "Booking confirmed...",
    data: bookingDetails // Each provider extracts what it needs
  }
});

// Results:
// ✅ WhatsApp: Template message sent
// ✅ Email: HTML email sent  
// ✅ SMS: Plain text sent
```

### **3. Force Specific Providers**

```typescript
// Send only via email and SMS (skip WhatsApp)
await notificationService.sendNotification({
  type: 'system',
  businessId: 'business-id',
  content: feedbackContent,
  preferredProviders: ['email', 'sms'] // Skip WhatsApp
});
```

### **4. Recipient Preferences**

```typescript
const recipients = [
  {
    userId: '1',
    phoneNumber: '+1234567890',
    email: 'admin@business.com',
    preferredChannel: 'whatsapp', // Will use WhatsApp provider
    name: 'Business Admin'
  },
  {
    userId: '2', 
    email: 'super@company.com',
    preferredChannel: 'email', // Will use Email provider
    name: 'Super Admin'
  }
];

await notificationService.sendNotification({
  type: 'booking',
  businessId: 'business-id',
  content: content,
  recipients: recipients
});
```

## 🔄 **Provider Fallback**

```typescript
// If WhatsApp templates fail, automatically falls back to regular messages
// If WhatsApp completely fails, tries SMS
// If SMS fails, tries Email

const result = await whatsappProvider.sendNotification(...);
if (!result.success) {
  // Automatically tries next provider
}
```

## 🛠️ **Provider Configuration**

```typescript
// Get information about all providers
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
//     templatesSupported: [],
//     maxMessageLength: 1600,
//     segmentLength: 160
//   },
//   email: {
//     templatesSupported: ['booking', 'system'],
//     supportsHtml: true,
//     supportsAttachments: true
//   }
// }
```

## 🏥 **Health Checks**

```typescript
// Check all provider health
const health = await notificationService.healthCheck();
console.log(health);
// Output:
// {
//   whatsapp: true,  // Has required credentials
//   sms: false,      // Missing Twilio credentials
//   email: true      // SendGrid configured
// }
```

## 📊 **Benefits of New Architecture**

### **✅ Isolation**
- WhatsApp templates don't affect SMS/Email
- Each provider handles its own requirements
- Adding providers doesn't break existing ones

### **✅ Scalability**
- Easy to add new providers (Push, Slack, Teams, etc.)
- Provider-specific features (templates, HTML, attachments)
- Automatic provider selection and fallback

### **✅ Flexibility**
- Recipients can choose preferred channels
- Force specific providers when needed
- Multi-provider delivery for reliability

### **✅ Maintainability**
- Clean separation of concerns
- Provider-specific logic isolated
- Easy testing and debugging

## 🔄 **Migration Strategy**

### **Phase 1: Gradual Migration**
```typescript
// Keep old service for existing code
const oldService = new GenericNotificationService();

// Use new service for new features
const newService = new ScalableNotificationService();
```

### **Phase 2: Switch Over**
```typescript
// Replace old calls
// OLD:
await GenericNotificationService.sendBookingNotification(businessId, details);

// NEW:
const notificationService = new ScalableNotificationService();
await notificationService.sendBookingNotification(businessId, details);
```

### **Phase 3: Deprecate Old Service**
- Remove old generic service
- Update all imports
- Clean up template-specific code

## 🎯 **Real-World Example**

```typescript
// Business receives WhatsApp template (for immediate attention)
// Super admin receives detailed HTML email (for records)
// Backup SMS if WhatsApp fails (reliability)

const notificationService = new ScalableNotificationService();
await notificationService.sendFeedbackNotification(businessId, {
  customerName: 'Jane Smith',
  feedbackText: 'Service was poor',
  businessName: 'Beauty Salon',
  timestamp: '2025-03-15'
});

// Results:
// 📱 Business Admin: WhatsApp template sent
// 📧 Super Admin: HTML email sent
// 💾 Database: Notification logged
// 🔄 Fallback: SMS ready if needed
```

This architecture ensures that **WhatsApp templates are isolated to WhatsApp only** and won't affect other providers like SMS, Email, Push notifications, etc. Each provider handles its own requirements without affecting others! 🎉 