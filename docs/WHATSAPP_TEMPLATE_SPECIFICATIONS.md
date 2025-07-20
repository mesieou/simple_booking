# 📱 WhatsApp Template Specifications for Meta Business Manager

This document provides the exact template specifications you need to create in Meta Business Manager for the notification system.

## 🎯 **Templates Required**

### 1. **Booking Confirmation Template**

**Template Name:** `booking_confirmation`  
**Category:** `UTILITY` (transactional)  
**Language:** `English (US)`

#### **Header:**
- **Type:** Text
- **Text:** `🎉 New booking for {{1}}!`
- **Variables:** 
  - `{{1}}` = Customer name

#### **Body:**
- **Text:** `📋 Booking {{1}} confirmed for {{2}} on {{3}} at {{4}}. Total: {{5}}`
- **Variables:**
  - `{{1}}` = Booking ID
  - `{{2}}` = Service name (or services display)
  - `{{3}}` = Date (formatted)
  - `{{4}}` = Time (formatted)
  - `{{5}}` = Total cost (including $ symbol)

#### **Footer:** *(Optional)*
- **Text:** `Check your admin dashboard for full details.`

---

### 2. **Negative Feedback Alert Template**

**Template Name:** `negative_feedback_alert`  
**Category:** `UTILITY` (transactional)  
**Language:** `English (US)`

#### **Header:**
- **Type:** Text
- **Text:** `⚠️ Negative feedback received`
- **Variables:** None

#### **Body:**
- **Text:** `Customer {{1}} from {{2}} left negative feedback on {{3}}: "{{4}}"`
- **Variables:**
  - `{{1}}` = Customer name
  - `{{2}}` = Business name
  - `{{3}}` = Date/timestamp
  - `{{4}}` = Feedback text

#### **Footer:** *(Optional)*
- **Text:** `Please review and take appropriate action.`

---

## 🔧 **Template Setup Instructions**

### **Step 1: Access Meta Business Manager**
1. Go to [business.facebook.com](https://business.facebook.com)
2. Navigate to **WhatsApp Manager**
3. Select your **WhatsApp Business Account**
4. Go to **Account tools** → **Message templates**

### **Step 2: Create Templates**
1. Click **Create template**
2. Fill in the details as specified above
3. Submit for review (usually takes 24-48 hours)

### **Step 3: Template Quality Guidelines**
- **Keep text concise** and avoid promotional language
- **Use clear variable placeholders** like `{{1}}`, `{{2}}`, etc.
- **Follow WhatsApp's template policies** (no marketing content in utility templates)
- **Test thoroughly** before production use

---

## 📋 **Template Data Mapping**

### **Booking Confirmation Variables:**
```typescript
{
  // Header variables
  customerName: "John Doe",           // {{1}} in header
  
  // Body variables  
  bookingId: "BK123456",              // {{1}} in body
  servicesDisplay: "Hair Cut & Style", // {{2}} in body (or serviceName)
  formattedDate: "March 15, 2025",    // {{3}} in body
  formattedTime: "2:30 PM",           // {{4}} in body
  totalCost: "$75.00"                 // {{5}} in body (includes $ symbol)
}
```

### **Negative Feedback Variables:**
```typescript
{
  // Body variables (no header variables)
  customerName: "Jane Smith",         // {{1}} in body
  businessName: "Beauty Salon XYZ",   // {{2}} in body
  timestamp: "March 15, 2025",        // {{3}} in body
  feedbackText: "Service was poor"    // {{4}} in body
}
```

---

## 📊 **Admin Notification Format**

Admins receive **detailed notifications** (same format as customer confirmations) via:

1. **WhatsApp Template** (concise version for instant alert)
2. **Regular WhatsApp Message** (full customer-style details as fallback)
3. **Email** (HTML formatted with all details)
4. **SMS** (condensed version for reliability)

### **Example Admin Notification:**

**Template Version (WhatsApp):**
```
🎉 New booking for John Doe!
📋 Booking BK123456 confirmed for Hair Cut & Style on March 15, 2025 at 2:30 PM. Total: $75.00
```

**Detailed Version (Regular Message):**
```
🎉 John Doe, booking confirmed!

💼 Service:
   Hair Cut & Style

💰 Total Cost: $75.00

📅 Date: March 15, 2025
⏰ Time: 2:30 PM
📍 Location: Main Street Salon

💳 Payment Summary:
   • Paid: $25.00
   • Balance Due: $50.00
   • Payment Method: cash/card

📞 Customer Contact:
   +1234567890

📄 Booking ID: BK123456

New booking confirmed and ready to serve!
```

---

## ⚠️ **Important Template Rules**

### **Character Limits:**
- **Header parameters:** Max 60 characters each
- **Body parameters:** Max 1024 characters each
- **Template names:** Lowercase, no spaces (use underscores)

### **Parameter Guidelines:**
- **No empty parameters** (system validates this)
- **No newlines or tabs** in parameters (auto-cleaned)
- **Special characters** are escaped automatically
- **Long text** is truncated to prevent API errors

### **Template Categories:**
- **UTILITY:** For transactional messages (our use case)
- **MARKETING:** For promotional content (different approval process)
- **AUTHENTICATION:** For OTP/verification codes

---

## 🧪 **Testing Templates**

Once approved, you can test templates using:

```bash
# Test booking confirmation
npm run test:notifications:booking

# Test negative feedback  
npm run test:notifications:feedback

# Test all templates
npm run test:notifications
```

---

## 🚨 **Troubleshooting**

### **Common Template Issues:**

1. **"Parameter count mismatch"**
   - Check template has exact number of variables as specified
   - Verify header vs body parameter counts

2. **"Invalid template name"**
   - Template names must be lowercase with underscores
   - No spaces or special characters allowed

3. **"Template not found"**
   - Template may still be under review
   - Check Meta Business Manager for approval status

4. **"Parameter too long"**
   - Check character limits above
   - System auto-truncates but logs warnings

### **Debug Commands:**
```bash
# Check template requirements
node -e "console.log(require('./lib/bot-engine/services/notification-providers/whatsapp-provider').WhatsAppProvider.prototype.getConfiguration())"

# Validate template parameters
npm run test:notifications:uuid -- --verbose
```

---

## 📞 **Support**

If templates are rejected or you encounter issues:

1. **Review Meta's template policies:** [developers.facebook.com/docs/whatsapp/message-templates](https://developers.facebook.com/docs/whatsapp/message-templates)
2. **Check approval status** in Meta Business Manager
3. **Modify and resubmit** if needed
4. **Test with our validation tools** before resubmitting

---

**Next Steps:** Once templates are approved in Meta, the system will automatically use them for all booking and feedback notifications! The admin will receive the same detailed information that customers see. 🎉 