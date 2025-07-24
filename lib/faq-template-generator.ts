// FAQ Template Generator - Creates downloadable templates for businesses

export interface FaqTemplateData {
  businessName?: string;
  businessType?: string;
  services?: string[];
}

export const generateFaqTemplate = (data?: FaqTemplateData): string => {
  const businessName = data?.businessName || '[Your Business Name]';
  const businessType = data?.businessType || 'service business';
  
  return `# Frequently Asked Questions (FAQ) Template
## ${businessName}

*Instructions: Fill out the answers to these questions based on your business. Delete any questions that don't apply to your ${businessType}. Add any additional questions your customers commonly ask.*

---

## 🗓️ BOOKING & SCHEDULING

**Q: How far in advance should I book?**
A: [Your answer - e.g., "We recommend booking at least 2 weeks in advance, especially during busy seasons."]

**Q: Can I reschedule my appointment?**
A: [Your answer - e.g., "Yes, you can reschedule up to 24 hours before your appointment without any fees."]

**Q: What happens if I need to cancel?**
A: [Your answer - e.g., "Cancellations made 48+ hours in advance receive a full refund. 24-48 hours: 50% refund. Less than 24 hours: no refund."]

**Q: What if I'm running late?**
A: [Your answer - e.g., "Please call us if you're running more than 15 minutes late. We'll do our best to accommodate you."]

**Q: Do you accommodate group bookings?**
A: [Your answer - e.g., "Yes, we offer group discounts for 5+ people. Contact us for special group rates."]

---

## 📍 LOCATION & ACCESS

**Q: Where exactly are you located?**
A: [Your answer - e.g., "We're located at [full address]. Look for the blue building with white trim."]

**Q: Is parking available?**
A: [Your answer - e.g., "Free parking is available in our lot. Street parking is also available on [street names]."]

**Q: Is your location wheelchair accessible?**
A: [Your answer - e.g., "Yes, we have wheelchair ramps and accessible facilities throughout our location."]

**Q: How do I find you/get access?**
A: [Your answer - e.g., "Enter through the main entrance on [street name]. Ring the doorbell if the door is locked."]

---

## 🎯 PREPARATION & REQUIREMENTS

**Q: What should I bring to my appointment?**
A: [Your answer - e.g., "Please bring a valid ID and any relevant documents. Wear comfortable clothing."]

**Q: How should I prepare beforehand?**
A: [Your answer - e.g., "No special preparation needed. Just arrive relaxed and ready to enjoy your service."]

**Q: Are there any age restrictions?**
A: [Your answer - e.g., "Clients must be 18+ or accompanied by a parent/guardian."]

**Q: What should I wear?**
A: [Your answer - e.g., "Wear comfortable, loose-fitting clothing. We provide protective covers as needed."]

---

## 🌤️ WEATHER & SPECIAL CIRCUMSTANCES

**Q: What happens if there's bad weather?**
A: [Your answer - e.g., "We operate rain or shine. In case of severe weather, we'll contact you about rescheduling."]

**Q: What if there's an emergency?**
A: [Your answer - e.g., "In case of emergencies, call us immediately at [phone number]. We'll reschedule at no charge."]

**Q: Do you provide services during holidays?**
A: [Your answer - e.g., "We're closed on major holidays but open most other days. Check our holiday schedule on our website."]

---

## 📞 COMMUNICATION & SUPPORT

**Q: What's the best way to contact you?**
A: [Your answer - e.g., "WhatsApp is fastest for urgent matters: [number]. Email for non-urgent: [email]."]

**Q: How quickly do you respond to messages?**
A: [Your answer - e.g., "We respond to WhatsApp within 2 hours during business hours, email within 24 hours."]

**Q: Can I get updates about my appointment?**
A: [Your answer - e.g., "Yes, we'll send you confirmation and reminder messages via WhatsApp."]

---

## ✨ SERVICE DETAILS

**Q: What's included in the service?**
A: [Your answer - e.g., "All our services include [list what's included]. Additional items can be added for extra cost."]

**Q: How long does the service take?**
A: [Your answer - e.g., "Most services take [duration]. We'll give you a more precise estimate when you book."]

**Q: Do you offer any guarantees?**
A: [Your answer - e.g., "We guarantee your satisfaction. If you're not happy, we'll make it right or provide a refund."]

**Q: Can I add extra services on the day?**
A: [Your answer - e.g., "Subject to availability and time constraints. We recommend adding extras when booking."]

---

## 💰 PRICING & PAYMENTS

**Q: Are there any hidden fees?**
A: [Your answer - e.g., "No hidden fees. The price quoted includes everything except optional add-ons."]

**Q: Do you offer discounts?**
A: [Your answer - e.g., "We offer 10% off for first-time customers and seasonal promotions. Ask about current offers!"]

**Q: What if the service takes longer than expected?**
A: [Your answer - e.g., "If it's our fault, no extra charge. If you request additional work, we'll quote you first."]

---

## 🔄 AFTER SERVICE

**Q: What should I expect after the service?**
A: [Your answer - e.g., "You'll receive care instructions and can contact us with any questions for 48 hours."]

**Q: Do you offer follow-up services?**
A: [Your answer - e.g., "Yes, we offer maintenance packages and follow-up appointments at discounted rates."]

**Q: How can I leave feedback?**
A: [Your answer - e.g., "We'd love your feedback! Leave reviews on Google, WhatsApp us, or use our feedback form."]

---

## 🆘 PROBLEM RESOLUTION

**Q: What if I'm not satisfied with the service?**
A: [Your answer - e.g., "Contact us within 24 hours. We'll work with you to resolve any issues promptly."]

**Q: What if something gets damaged?**
A: [Your answer - e.g., "We're fully insured. Report any damage immediately and we'll handle it through our insurance."]

**Q: Who do I contact for complaints?**
A: [Your answer - e.g., "Contact the manager directly at [contact info] for any serious concerns."]

---

## 📝 POLICIES & TERMS

**Q: Do you have a privacy policy?**
A: [Your answer - e.g., "Yes, we protect your personal information. Full privacy policy available at [website/location]."]

**Q: What are your terms of service?**
A: [Your answer - e.g., "Terms available on our website. Key points: [list 2-3 main policies]."]

**Q: Can I refer friends?**
A: [Your answer - e.g., "Yes! Refer a friend and you both get [discount/benefit]. No limit on referrals!"]

---

## 📱 ADDITIONAL QUESTIONS

*Add any other questions specific to your business:*

**Q: [Your custom question]**
A: [Your answer]

**Q: [Your custom question]**
A: [Your answer]

**Q: [Your custom question]**
A: [Your answer]

---

*Template created by Skedy - Smart Booking System*
*Need help? Contact support at support@skedy.com*

---

## 💡 TIPS FOR COMPLETING THIS TEMPLATE:

1. **Be Specific**: Give exact details (times, prices, locations) rather than vague answers
2. **Be Helpful**: Think from your customer's perspective - what would they want to know?
3. **Be Honest**: Set clear expectations to avoid misunderstandings
4. **Update Regularly**: Review and update your FAQ as your business evolves
5. **Test with Customers**: Ask recent customers what questions they had that aren't covered

## 🎯 COMMON MISTAKE TO AVOID:

- Don't just copy-paste generic answers
- Don't leave placeholder text like "[Your answer]"
- Don't skip questions that seem obvious to you (they might not be to customers)
- Don't forget to proofread for typos and clarity`;
};

// Generate a Word-compatible document format
export const generateWordTemplate = (data?: FaqTemplateData): string => {
  const businessName = data?.businessName || '[Your Business Name]';
  const businessType = data?.businessType || 'service business';
  
  return `Frequently Asked Questions (FAQ) Template
${businessName}

Instructions: Fill out the answers to these questions based on your business. Delete any questions that don't apply to your ${businessType}. Add any additional questions your customers commonly ask.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BOOKING & SCHEDULING

Q: How far in advance should I book?
A: [Your answer - e.g., "We recommend booking at least 2 weeks in advance, especially during busy seasons."]

Q: Can I reschedule my appointment?
A: [Your answer - e.g., "Yes, you can reschedule up to 24 hours before your appointment without any fees."]

Q: What happens if I need to cancel?
A: [Your answer - e.g., "Cancellations made 48+ hours in advance receive a full refund. 24-48 hours: 50% refund. Less than 24 hours: no refund."]

Q: What if I'm running late?
A: [Your answer - e.g., "Please call us if you're running more than 15 minutes late. We'll do our best to accommodate you."]

Q: Do you accommodate group bookings?
A: [Your answer - e.g., "Yes, we offer group discounts for 5+ people. Contact us for special group rates."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOCATION & ACCESS

Q: Where exactly are you located?
A: [Your answer - e.g., "We're located at [full address]. Look for the blue building with white trim."]

Q: Is parking available?
A: [Your answer - e.g., "Free parking is available in our lot. Street parking is also available on [street names]."]

Q: Is your location wheelchair accessible?
A: [Your answer - e.g., "Yes, we have wheelchair ramps and accessible facilities throughout our location."]

Q: How do I find you/get access?
A: [Your answer - e.g., "Enter through the main entrance on [street name]. Ring the doorbell if the door is locked."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PREPARATION & REQUIREMENTS

Q: What should I bring to my appointment?
A: [Your answer - e.g., "Please bring a valid ID and any relevant documents. Wear comfortable clothing."]

Q: How should I prepare beforehand?
A: [Your answer - e.g., "No special preparation needed. Just arrive relaxed and ready to enjoy your service."]

Q: Are there any age restrictions?
A: [Your answer - e.g., "Clients must be 18+ or accompanied by a parent/guardian."]

Q: What should I wear?
A: [Your answer - e.g., "Wear comfortable, loose-fitting clothing. We provide protective covers as needed."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WEATHER & SPECIAL CIRCUMSTANCES

Q: What happens if there's bad weather?
A: [Your answer - e.g., "We operate rain or shine. In case of severe weather, we'll contact you about rescheduling."]

Q: What if there's an emergency?
A: [Your answer - e.g., "In case of emergencies, call us immediately at [phone number]. We'll reschedule at no charge."]

Q: Do you provide services during holidays?
A: [Your answer - e.g., "We're closed on major holidays but open most other days. Check our holiday schedule on our website."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMUNICATION & SUPPORT

Q: What's the best way to contact you?
A: [Your answer - e.g., "WhatsApp is fastest for urgent matters: [number]. Email for non-urgent: [email]."]

Q: How quickly do you respond to messages?
A: [Your answer - e.g., "We respond to WhatsApp within 2 hours during business hours, email within 24 hours."]

Q: Can I get updates about my appointment?
A: [Your answer - e.g., "Yes, we'll send you confirmation and reminder messages via WhatsApp."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SERVICE DETAILS

Q: What's included in the service?
A: [Your answer - e.g., "All our services include [list what's included]. Additional items can be added for extra cost."]

Q: How long does the service take?
A: [Your answer - e.g., "Most services take [duration]. We'll give you a more precise estimate when you book."]

Q: Do you offer any guarantees?
A: [Your answer - e.g., "We guarantee your satisfaction. If you're not happy, we'll make it right or provide a refund."]

Q: Can I add extra services on the day?
A: [Your answer - e.g., "Subject to availability and time constraints. We recommend adding extras when booking."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRICING & PAYMENTS

Q: Are there any hidden fees?
A: [Your answer - e.g., "No hidden fees. The price quoted includes everything except optional add-ons."]

Q: Do you offer discounts?
A: [Your answer - e.g., "We offer 10% off for first-time customers and seasonal promotions. Ask about current offers!"]

Q: What if the service takes longer than expected?
A: [Your answer - e.g., "If it's our fault, no extra charge. If you request additional work, we'll quote you first."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AFTER SERVICE

Q: What should I expect after the service?
A: [Your answer - e.g., "You'll receive care instructions and can contact us with any questions for 48 hours."]

Q: Do you offer follow-up services?
A: [Your answer - e.g., "Yes, we offer maintenance packages and follow-up appointments at discounted rates."]

Q: How can I leave feedback?
A: [Your answer - e.g., "We'd love your feedback! Leave reviews on Google, WhatsApp us, or use our feedback form."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM RESOLUTION

Q: What if I'm not satisfied with the service?
A: [Your answer - e.g., "Contact us within 24 hours. We'll work with you to resolve any issues promptly."]

Q: What if something gets damaged?
A: [Your answer - e.g., "We're fully insured. Report any damage immediately and we'll handle it through our insurance."]

Q: Who do I contact for complaints?
A: [Your answer - e.g., "Contact the manager directly at [contact info] for any serious concerns."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POLICIES & TERMS

Q: Do you have a privacy policy?
A: [Your answer - e.g., "Yes, we protect your personal information. Full privacy policy available at [website/location]."]

Q: What are your terms of service?
A: [Your answer - e.g., "Terms available on our website. Key points: [list 2-3 main policies]."]

Q: Can I refer friends?
A: [Your answer - e.g., "Yes! Refer a friend and you both get [discount/benefit]. No limit on referrals!"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADDITIONAL QUESTIONS

Add any other questions specific to your business:

Q: [Your custom question]
A: [Your answer]

Q: [Your custom question]
A: [Your answer]

Q: [Your custom question]
A: [Your answer]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Template created by Skedy - Smart Booking System
Need help? Contact support at support@skedy.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIPS FOR COMPLETING THIS TEMPLATE:

1. Be Specific: Give exact details (times, prices, locations) rather than vague answers
2. Be Helpful: Think from your customer's perspective - what would they want to know?
3. Be Honest: Set clear expectations to avoid misunderstandings
4. Update Regularly: Review and update your FAQ as your business evolves
5. Test with Customers: Ask recent customers what questions they had that aren't covered

COMMON MISTAKES TO AVOID:

- Don't just copy-paste generic answers
- Don't leave placeholder text like "[Your answer]"
- Don't skip questions that seem obvious to you (they might not be to customers)
- Don't forget to proofread for typos and clarity

HOW TO SAVE AS PDF:
1. Copy this entire document
2. Paste into Microsoft Word or Google Docs
3. Fill out all your answers
4. Save/Export as PDF
5. Upload the PDF in the onboarding form`;
};

// Generate proper Word-compatible HTML document
export const generateWordCompatibleHTML = (data?: FaqTemplateData): string => {
  const businessName = data?.businessName || '[Your Business Name]';
  const businessType = data?.businessType || 'service business';

  // Generate business-specific content based on type
  if (businessType === 'removalists' || businessType === 'removalist') {
    return generateRemovalistsFAQ(businessName);
  } else if (businessType === 'salon' || businessType === 'hair salon' || businessType === 'beauty salon') {
    return generateSalonFAQ(businessName);
  } else {
    return generateGenericFAQ(businessName, businessType);
  }
};

const generateRemovalistsFAQ = (businessName: string): string => {
  return `<html>
<head>
<meta charset="utf-8">
<style>
body {
  font-family: 'Calibri', Arial, sans-serif;
  line-height: 1.6;
  margin: 1.2in;
  color: #333;
}
h1 {
  font-size: 24pt;
  font-weight: bold;
  text-align: center;
  color: #2c3e50;
  margin-bottom: 8pt;
  text-transform: uppercase;
  letter-spacing: 1pt;
}
h2 {
  font-size: 18pt;
  font-weight: bold;
  text-align: center;
  color: #34495e;
  margin-top: 16pt;
  margin-bottom: 12pt;
  background-color: #ecf0f1;
  padding: 10pt;
  border-radius: 4pt;
}
h3 {
  font-size: 14pt;
  font-weight: bold;
  color: #2c3e50;
  margin-top: 20pt;
  margin-bottom: 8pt;
  text-transform: uppercase;
  border-bottom: 2pt solid #3498db;
  padding-bottom: 4pt;
}
.instructions {
  font-size: 11pt;
  font-style: italic;
  background-color: #e8f6f3;
  padding: 12pt;
  margin: 16pt 0;
  border-left: 4pt solid #27ae60;
  border-radius: 4pt;
}
.question {
  font-size: 12pt;
  font-weight: bold;
  color: #2c3e50;
  margin-top: 12pt;
  margin-bottom: 4pt;
}
.answer {
  font-size: 11pt;
  margin-bottom: 12pt;
  margin-left: 20pt;
  color: #555;
}
.tips {
  font-size: 10pt;
  background-color: #fff3cd;
  padding: 12pt;
  margin: 20pt 0;
  border-radius: 4pt;
  border: 1pt solid #ffeaa7;
}
.tips h4 {
  font-size: 12pt;
  font-weight: bold;
  color: #856404;
  margin-bottom: 8pt;
}
.footer {
  font-size: 9pt;
  text-align: center;
  margin-top: 30pt;
  padding-top: 15pt;
  border-top: 1pt solid #bdc3c7;
  color: #7f8c8d;
}
</style>
</head>
<body>

<h1>Frequently Asked Questions (FAQ) Template</h1>

<h2>${businessName} - Removalists</h2>

<div class="instructions">
<strong>Instructions:</strong> Fill out the answers to these questions based on your removalist business. Delete any questions that don't apply to your services. Add any additional questions your customers commonly ask about moving services.
</div>

<h3>Booking & Quotes</h3>

<div class="question">Q: How do you provide quotes?</div>
<div class="answer">A: [Your answer - e.g., "We offer free quotes via phone, email, or in-home assessment. Online quotes available 24/7."]</div>

<div class="question">Q: How far in advance should I book?</div>
<div class="answer">A: [Your answer - e.g., "We recommend booking 2-4 weeks in advance, especially during peak season (summer months and end of month)."]</div>

<div class="question">Q: Are quotes binding or can the price change?</div>
<div class="answer">A: [Your answer - e.g., "Our quotes are fixed provided the inventory and circumstances don't change. Any additional items will be quoted separately."]</div>

<div class="question">Q: Do you provide quotes on weekends?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we provide quotes 7 days a week. Phone quotes available immediately, in-home assessments scheduled within 48 hours."]</div>

<div class="question">Q: What information do you need for an accurate quote?</div>
<div class="answer">A: [Your answer - e.g., "We need your inventory list, pickup and delivery addresses, preferred dates, and any access issues (stairs, long carries, parking restrictions)."]</div>

<h3>Services & What's Included</h3>

<div class="question">Q: What's included in your moving service?</div>
<div class="answer">A: [Your answer - e.g., "Our service includes professional movers, fully equipped truck, furniture blankets, straps, and basic tools. Packing materials available separately."]</div>

<div class="question">Q: Do you disassemble and reassemble furniture?</div>
<div class="answer">A: [Your answer - e.g., "Yes, basic furniture assembly/disassembly is included. Complex items like pool tables or trampolines incur additional charges."]</div>

<div class="question">Q: Can you pack my belongings?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we offer full packing services. You can also do partial packing yourself and leave fragile items to us."]</div>

<div class="question">Q: Do you provide packing materials?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we supply boxes, tape, bubble wrap, and paper. We can deliver materials in advance or supply on moving day."]</div>

<div class="question">Q: Can you move specialty items (piano, artwork, antiques)?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we handle specialty items with extra care. Some items require special equipment or techniques - please mention these when booking."]</div>

<h3>Pricing & Payment</h3>

<div class="question">Q: How do you charge - hourly or fixed price?</div>
<div class="answer">A: [Your answer - e.g., "Local moves are typically hourly, long-distance moves are fixed price. We'll explain which applies to your move."]</div>

<div class="question">Q: What payment methods do you accept?</div>
<div class="answer">A: [Your answer - e.g., "We accept cash, credit cards, and bank transfers. Payment is typically due upon completion of the move."]</div>

<div class="question">Q: Are there any additional fees I should know about?</div>
<div class="answer">A: [Your answer - e.g., "Additional fees may apply for stairs (above 2nd floor), long carries (over 50 meters), or if access requires shuttle truck."]</div>

<div class="question">Q: Do you charge for travel time?</div>
<div class="answer">A: [Your answer - e.g., "For hourly jobs, we charge from arrival at pickup location to completion. No travel time charged to/from our depot."]</div>

<div class="question">Q: What if the move takes longer than expected?</div>
<div class="answer">A: [Your answer - e.g., "For hourly rates, you pay for actual time worked. For fixed prices, no extra charge unless you add items not in the original quote."]</div>

<h3>Moving Day Logistics</h3>

<div class="question">Q: What time will you arrive?</div>
<div class="answer">A: [Your answer - e.g., "We provide a 2-hour arrival window and call 30 minutes before arrival. Morning slots start at 8am, afternoon slots at 1pm."]</div>

<div class="question">Q: What if I'm not ready when you arrive?</div>
<div class="answer">A: [Your answer - e.g., "We'll wait up to 15 minutes free. After that, waiting time is charged at our hourly rate. We recommend being fully packed and ready."]</div>

<div class="question">Q: How many movers will you send?</div>
<div class="answer">A: [Your answer - e.g., "Typically 2-3 movers depending on your move size. Large moves may require 4+ movers for efficiency."]</div>

<div class="question">Q: What happens if weather is bad?</div>
<div class="answer">A: [Your answer - e.g., "We move in most weather conditions. In severe weather, we'll contact you to discuss rescheduling options."]</div>

<div class="question">Q: Should I empty drawers and cupboards?</div>
<div class="answer">A: [Your answer - e.g., "Yes, please empty all drawers and cupboards. Heavy furniture is easier to move when empty and prevents damage to contents."]</div>

<h3>Insurance & Protection</h3>

<div class="question">Q: Are my belongings insured during the move?</div>
<div class="answer">A: [Your answer - e.g., "We carry public liability and goods in transit insurance. We also offer additional transit insurance for high-value items."]</div>

<div class="question">Q: What if something gets damaged?</div>
<div class="answer">A: [Your answer - e.g., "Report damage immediately. We investigate all claims fairly and settle according to our insurance policy terms."]</div>

<div class="question">Q: Do you use furniture blankets and padding?</div>
<div class="answer">A: [Your answer - e.g., "Yes, all furniture is wrapped in professional moving blankets and secured properly to prevent damage during transport."]</div>

<div class="question">Q: How do you protect floors and walls?</div>
<div class="answer">A: [Your answer - e.g., "We use floor runners and door jamb protectors at no extra charge to protect your property during the move."]</div>

<h3>Storage Services</h3>

<div class="question">Q: Do you offer storage if my new place isn't ready?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we have secure storage facilities available for short or long-term storage. Items are stored in containers for easy access."]</div>

<div class="question">Q: How secure is your storage facility?</div>
<div class="answer">A: [Your answer - e.g., "Our facility is fully secured with 24/7 surveillance, controlled access, and individual container storage for your peace of mind."]</div>

<div class="question">Q: Can I access my items while in storage?</div>
<div class="answer">A: [Your answer - e.g., "Yes, you can access your items with 24 hours notice. Our staff will arrange access during business hours."]</div>

<h3>Special Circumstances</h3>

<div class="question">Q: Can you move on weekends and public holidays?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we work 7 days a week including most public holidays. Weekend and holiday rates may apply."]</div>

<div class="question">Q: Do you do interstate or long-distance moves?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we handle moves Australia-wide. Interstate moves require more planning so book early for best availability."]</div>

<div class="question">Q: What if there are parking restrictions at my address?</div>
<div class="answer">A: [Your answer - e.g., "Please arrange parking permits if required. If we can't park close, we may need to use a shuttle truck (additional charges apply)."]</div>

<div class="question">Q: Can you help with cleaning after we move out?</div>
<div class="answer">A: [Your answer - e.g., "We can recommend trusted cleaning services. Some of our team also offer basic cleaning services - ask when booking."]</div>

<h3>Additional Questions</h3>

<p style="font-style: italic; margin-bottom: 12pt;">Add any other questions specific to your removalist business:</p>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="tips">
<h4>💡 Tips for Completing This Template:</h4>
<ol>
<li><strong>Be Specific:</strong> Include exact prices, timeframes, and service details</li>
<li><strong>Address Common Concerns:</strong> Moving is stressful - reassure customers about protection and reliability</li>
<li><strong>Set Clear Expectations:</strong> Be upfront about additional charges and what's included</li>
<li><strong>Include Contact Information:</strong> Make it easy for customers to reach you with questions</li>
<li><strong>Update Seasonally:</strong> Adjust pricing and availability information regularly</li>
</ol>

<h4>🎯 Common Mistakes to Avoid:</h4>
<ul>
<li>Don't leave pricing vague - customers want to know what they'll pay</li>
<li>Don't forget to mention insurance and damage policies</li>
<li>Don't skip information about stairs, long carries, and access issues</li>
<li>Don't forget to explain your cancellation and rescheduling policies</li>
</ul>

<h4>📄 How to Save as PDF:</h4>
<ol>
<li>Fill out all your answers with specific details about your removalist services</li>
<li>Go to File → Save As → Choose PDF format</li>
<li>Upload the PDF in the onboarding form</li>
</ol>
</div>

<div class="footer">
<strong>Template created by Skedy - Smart Booking System</strong><br>
Need help? Contact support at support@skedy.com
</div>

</body>
</html>`;
};

const generateSalonFAQ = (businessName: string): string => {
  return `<html>
<head>
<meta charset="utf-8">
<style>
body {
  font-family: 'Calibri', Arial, sans-serif;
  line-height: 1.6;
  margin: 1.2in;
  color: #333;
}
h1 {
  font-size: 24pt;
  font-weight: bold;
  text-align: center;
  color: #2c3e50;
  margin-bottom: 8pt;
  text-transform: uppercase;
  letter-spacing: 1pt;
}
h2 {
  font-size: 18pt;
  font-weight: bold;
  text-align: center;
  color: #34495e;
  margin-top: 16pt;
  margin-bottom: 12pt;
  background-color: #ecf0f1;
  padding: 10pt;
  border-radius: 4pt;
}
h3 {
  font-size: 14pt;
  font-weight: bold;
  color: #2c3e50;
  margin-top: 20pt;
  margin-bottom: 8pt;
  text-transform: uppercase;
  border-bottom: 2pt solid #3498db;
  padding-bottom: 4pt;
}
.instructions {
  font-size: 11pt;
  font-style: italic;
  background-color: #e8f6f3;
  padding: 12pt;
  margin: 16pt 0;
  border-left: 4pt solid #27ae60;
  border-radius: 4pt;
}
.question {
  font-size: 12pt;
  font-weight: bold;
  color: #2c3e50;
  margin-top: 12pt;
  margin-bottom: 4pt;
}
.answer {
  font-size: 11pt;
  margin-bottom: 12pt;
  margin-left: 20pt;
  color: #555;
}
.tips {
  font-size: 10pt;
  background-color: #fff3cd;
  padding: 12pt;
  margin: 20pt 0;
  border-radius: 4pt;
  border: 1pt solid #ffeaa7;
}
.tips h4 {
  font-size: 12pt;
  font-weight: bold;
  color: #856404;
  margin-bottom: 8pt;
}
.footer {
  font-size: 9pt;
  text-align: center;
  margin-top: 30pt;
  padding-top: 15pt;
  border-top: 1pt solid #bdc3c7;
  color: #7f8c8d;
}
</style>
</head>
<body>

<h1>Frequently Asked Questions (FAQ) Template</h1>

<h2>${businessName} - Hair & Beauty Salon</h2>

<div class="instructions">
<strong>Instructions:</strong> Fill out the answers to these questions based on your salon business. Delete any questions that don't apply to your services. Add any additional questions your clients commonly ask about hair and beauty services.
</div>

<h3>Booking & Appointments</h3>

<div class="question">Q: How far in advance should I book?</div>
<div class="answer">A: [Your answer - e.g., "We recommend booking 2-3 weeks in advance for popular services like highlights or special occasions. Cut and blow-dry usually available within a week."]</div>

<div class="question">Q: Can I book online?</div>
<div class="answer">A: [Your answer - e.g., "Yes, you can book 24/7 through our website or app. You can also call during business hours or text us for quick bookings."]</div>

<div class="question">Q: What's your cancellation policy?</div>
<div class="answer">A: [Your answer - e.g., "We require 24 hours notice for cancellations. Less than 24 hours notice may incur a 50% charge. No-shows are charged the full service amount."]</div>

<div class="question">Q: What if I'm running late?</div>
<div class="answer">A: [Your answer - e.g., "Please call if you're running more than 10 minutes late. We may need to reschedule if it affects other clients, but we'll try to accommodate you."]</div>

<div class="question">Q: Do you take walk-ins?</div>
<div class="answer">A: [Your answer - e.g., "We welcome walk-ins based on availability. Appointments take priority, so waiting times may vary during busy periods."]</div>

<h3>Hair Services & Pricing</h3>

<div class="question">Q: How much do your services cost?</div>
<div class="answer">A: [Your answer - e.g., "Prices vary by service and stylist level. Cut and blow-dry from $65, color from $95, highlights from $135. Full price list available on our website."]</div>

<div class="question">Q: Should I wash my hair before coming in?</div>
<div class="answer">A: [Your answer - e.g., "Come with hair as normal - we'll assess and wash if needed. For color services, it's often better to come with day-old hair."]</div>

<div class="question">Q: How long do appointments take?</div>
<div class="answer">A: [Your answer - e.g., "Cut and blow-dry: 45-60 mins, Color: 2-3 hours, Highlights: 3-4 hours. We'll give you an accurate time estimate when booking."]</div>

<div class="question">Q: Do you offer consultations?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we offer free 15-minute consultations for new clients or major changes. This helps us understand your hair and desired look."]</div>

<div class="question">Q: Can you match a photo I bring in?</div>
<div class="answer">A: [Your answer - e.g., "We love inspiration photos! We'll discuss what's achievable with your hair type and condition, and create a plan to get you as close as possible."]</div>

<h3>Hair Color & Chemical Services</h3>

<div class="question">Q: How often should I get my color touched up?</div>
<div class="answer">A: [Your answer - e.g., "Root touch-ups every 4-6 weeks, full color every 8-12 weeks, highlights every 8-12 weeks depending on your hair growth and desired maintenance."]</div>

<div class="question">Q: Can you color over previously colored hair?</div>
<div class="answer">A: [Your answer - e.g., "Yes, but we may need multiple sessions for dramatic changes. We'll assess your hair's condition and create a safe color plan."]</div>

<div class="question">Q: Do you do color corrections?</div>
<div class="answer">A: [Your answer - e.g., "Yes, our senior stylists specialize in color correction. These services require consultation and may take multiple appointments to achieve safely."]</div>

<div class="question">Q: How do I maintain my hair color between appointments?</div>
<div class="answer">A: [Your answer - e.g., "Use sulfate-free shampoo, wash in cool water, use a color-protecting mask weekly, and avoid excessive heat. We'll recommend specific products for your color."]</div>

<div class="question">Q: Can I get color if I'm pregnant?</div>
<div class="answer">A: [Your answer - e.g., "We recommend checking with your doctor first. Many expectant mothers choose highlights over full color, and we use ammonia-free options when possible."]</div>

<h3>Hair Care & Maintenance</h3>

<div class="question">Q: What products do you recommend?</div>
<div class="answer">A: [Your answer - e.g., "We carry professional lines including [brand names]. Your stylist will recommend specific products based on your hair type and services."]</div>

<div class="question">Q: How often should I get my hair cut?</div>
<div class="answer">A: [Your answer - e.g., "Every 6-8 weeks for short styles, 8-12 weeks for longer hair. Regular trims keep your style looking fresh and prevent split ends."]</div>

<div class="question">Q: Can you help with damaged hair?</div>
<div class="answer">A: [Your answer - e.g., "Absolutely! We offer deep conditioning treatments, protein treatments, and damage repair services. We'll assess your hair and create a treatment plan."]</div>

<div class="question">Q: Do you offer hair treatments?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we offer various treatments including deep conditioning, keratin treatments, and glossing services. These can be added to any appointment."]</div>

<h3>Special Services & Events</h3>

<div class="question">Q: Do you do wedding hair and makeup?</div>
<div class="answer">A: [Your answer - e.g., "Yes! We offer bridal packages including trials, wedding day services, and bridal party styling. Book early as wedding season fills up quickly."]</div>

<div class="question">Q: Can you do hair for special events?</div>
<div class="answer">A: [Your answer - e.g., "Absolutely! We specialize in formal updos, party styles, and special occasion looks. We recommend booking a trial for important events."]</div>

<div class="question">Q: Do you offer group bookings?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we love group bookings for birthdays, hen parties, and bridal parties. We can arrange for multiple stylists and special group rates."]</div>

<div class="question">Q: Do you come to my location for special events?</div>
<div class="answer">A: [Your answer - e.g., "We offer mobile services for weddings and special events within [distance] of our salon. Travel fees apply and advance booking required."]</div>

<h3>Salon Policies & Information</h3>

<div class="question">Q: What are your opening hours?</div>
<div class="answer">A: [Your answer - e.g., "Tuesday-Friday 9am-7pm, Saturday 8am-5pm, Sunday 10am-4pm. Closed Mondays. Extended hours available for special events."]</div>

<div class="question">Q: What payment methods do you accept?</div>
<div class="answer">A: [Your answer - e.g., "We accept cash, all major credit cards, and EFTPOS. We also offer Afterpay for services over $100."]</div>

<div class="question">Q: Do you offer gift vouchers?</div>
<div class="answer">A: [Your answer - e.g., "Yes! Gift vouchers available for any amount or specific services. Perfect for birthdays, Christmas, or any special occasion."]</div>

<div class="question">Q: Is parking available?</div>
<div class="answer">A: [Your answer - e.g., "Free parking available directly behind the salon. Street parking also available on [street names]."]</div>

<div class="question">Q: Are children welcome?</div>
<div class="answer">A: [Your answer - e.g., "We welcome well-behaved children and offer kids' cuts. For safety and relaxation of other clients, we ask that children stay seated during services."]</div>

<h3>Problem Resolution & Satisfaction</h3>

<div class="question">Q: What if I'm not happy with my service?</div>
<div class="answer">A: [Your answer - e.g., "Your satisfaction is our priority. Please let us know within 7 days and we'll arrange for adjustments or corrections at no charge."]</div>

<div class="question">Q: Do you offer refunds?</div>
<div class="answer">A: [Your answer - e.g., "We don't typically offer refunds on services, but we will correct any issues or provide alternative solutions to ensure your satisfaction."]</div>

<div class="question">Q: Can I speak to the manager if I have concerns?</div>
<div class="answer">A: [Your answer - e.g., "Absolutely. Our salon manager is available to discuss any concerns and ensure we resolve any issues to your satisfaction."]</div>

<div class="question">Q: How can I leave feedback or reviews?</div>
<div class="answer">A: [Your answer - e.g., "We'd love your feedback! You can leave reviews on Google, Facebook, or speak directly with your stylist or our manager."]</div>

<h3>Additional Questions</h3>

<p style="font-style: italic; margin-bottom: 12pt;">Add any other questions specific to your salon:</p>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="tips">
<h4>💡 Tips for Completing This Template:</h4>
<ol>
<li><strong>Be Specific About Timing:</strong> Clients want to know exactly how long services take</li>
<li><strong>Address Hair Concerns:</strong> Include information about damage, color-treated hair, and maintenance</li>
<li><strong>Explain Your Policies:</strong> Be clear about cancellations, late arrivals, and satisfaction guarantees</li>
<li><strong>Include Pricing Guidance:</strong> Help clients budget by providing price ranges</li>
<li><strong>Emphasize Expertise:</strong> Highlight your team's qualifications and specializations</li>
</ol>

<h4>🎯 Common Mistakes to Avoid:</h4>
<ul>
<li>Don't skip information about color maintenance and aftercare</li>
<li>Don't forget to explain consultation processes for major changes</li>
<li>Don't leave pricing completely vague - give ranges or starting prices</li>
<li>Don't forget to mention products and retail recommendations</li>
</ul>

<h4>📄 How to Save as PDF:</h4>
<ol>
<li>Fill out all your answers with specific details about your salon services</li>
<li>Go to File → Save As → Choose PDF format</li>
<li>Upload the PDF in the onboarding form</li>
</ol>
</div>

<div class="footer">
<strong>Template created by Skedy - Smart Booking System</strong><br>
Need help? Contact support at support@skedy.com
</div>

</body>
</html>`;
};

const generateGenericFAQ = (businessName: string, businessType: string): string => {
  return `<html>
<head>
<meta charset="utf-8">
<style>
body {
  font-family: 'Calibri', Arial, sans-serif;
  line-height: 1.6;
  margin: 1.2in;
  color: #333;
}
h1 {
  font-size: 24pt;
  font-weight: bold;
  text-align: center;
  color: #2c3e50;
  margin-bottom: 8pt;
  text-transform: uppercase;
  letter-spacing: 1pt;
}
h2 {
  font-size: 18pt;
  font-weight: bold;
  text-align: center;
  color: #34495e;
  margin-top: 16pt;
  margin-bottom: 12pt;
  background-color: #ecf0f1;
  padding: 10pt;
  border-radius: 4pt;
}
h3 {
  font-size: 14pt;
  font-weight: bold;
  color: #2c3e50;
  margin-top: 20pt;
  margin-bottom: 8pt;
  text-transform: uppercase;
  border-bottom: 2pt solid #3498db;
  padding-bottom: 4pt;
}
.instructions {
  font-size: 11pt;
  font-style: italic;
  background-color: #e8f6f3;
  padding: 12pt;
  margin: 16pt 0;
  border-left: 4pt solid #27ae60;
  border-radius: 4pt;
}
.question {
  font-size: 12pt;
  font-weight: bold;
  color: #2c3e50;
  margin-top: 12pt;
  margin-bottom: 4pt;
}
.answer {
  font-size: 11pt;
  margin-bottom: 12pt;
  margin-left: 20pt;
  color: #555;
}
.tips {
  font-size: 10pt;
  background-color: #fff3cd;
  padding: 12pt;
  margin: 20pt 0;
  border-radius: 4pt;
  border: 1pt solid #ffeaa7;
}
.tips h4 {
  font-size: 12pt;
  font-weight: bold;
  color: #856404;
  margin-bottom: 8pt;
}
.footer {
  font-size: 9pt;
  text-align: center;
  margin-top: 30pt;
  padding-top: 15pt;
  border-top: 1pt solid #bdc3c7;
  color: #7f8c8d;
}
</style>
</head>
<body>

<h1>Frequently Asked Questions (FAQ) Template</h1>

<h2>${businessName}</h2>

<div class="instructions">
<strong>Instructions:</strong> Fill out the answers to these questions based on your business. Delete any questions that don't apply to your ${businessType}. Add any additional questions your customers commonly ask.
</div>

<h3>Booking & Scheduling</h3>

<div class="question">Q: How far in advance should I book?</div>
<div class="answer">A: [Your answer - e.g., "We recommend booking at least 2 weeks in advance, especially during busy seasons."]</div>

<div class="question">Q: Can I reschedule my appointment?</div>
<div class="answer">A: [Your answer - e.g., "Yes, you can reschedule up to 24 hours before your appointment without any fees."]</div>

<div class="question">Q: What happens if I need to cancel?</div>
<div class="answer">A: [Your answer - e.g., "Cancellations made 48+ hours in advance receive a full refund. 24-48 hours: 50% refund. Less than 24 hours: no refund."]</div>

<div class="question">Q: What if I'm running late?</div>
<div class="answer">A: [Your answer - e.g., "Please call us if you're running more than 15 minutes late. We'll do our best to accommodate you."]</div>

<div class="question">Q: Do you accommodate group bookings?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we offer group discounts for 5+ people. Contact us for special group rates."]</div>

<h3>Location & Access</h3>

<div class="question">Q: Where exactly are you located?</div>
<div class="answer">A: [Your answer - e.g., "We're located at [full address]. Look for the blue building with white trim."]</div>

<div class="question">Q: Is parking available?</div>
<div class="answer">A: [Your answer - e.g., "Free parking is available in our lot. Street parking is also available on [street names]."]</div>

<div class="question">Q: Is your location wheelchair accessible?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we have wheelchair ramps and accessible facilities throughout our location."]</div>

<div class="question">Q: How do I find you/get access?</div>
<div class="answer">A: [Your answer - e.g., "Enter through the main entrance on [street name]. Ring the doorbell if the door is locked."]</div>

<h3>Preparation & Requirements</h3>

<div class="question">Q: What should I bring to my appointment?</div>
<div class="answer">A: [Your answer - e.g., "Please bring a valid ID and any relevant documents. Wear comfortable clothing."]</div>

<div class="question">Q: How should I prepare beforehand?</div>
<div class="answer">A: [Your answer - e.g., "No special preparation needed. Just arrive relaxed and ready to enjoy your service."]</div>

<div class="question">Q: Are there any age restrictions?</div>
<div class="answer">A: [Your answer - e.g., "Clients must be 18+ or accompanied by a parent/guardian."]</div>

<div class="question">Q: What should I wear?</div>
<div class="answer">A: [Your answer - e.g., "Wear comfortable, loose-fitting clothing. We provide protective covers as needed."]</div>

<h3>Weather & Special Circumstances</h3>

<div class="question">Q: What happens if there's bad weather?</div>
<div class="answer">A: [Your answer - e.g., "We operate rain or shine. In case of severe weather, we'll contact you about rescheduling."]</div>

<div class="question">Q: What if there's an emergency?</div>
<div class="answer">A: [Your answer - e.g., "In case of emergencies, call us immediately at [phone number]. We'll reschedule at no charge."]</div>

<div class="question">Q: Do you provide services during holidays?</div>
<div class="answer">A: [Your answer - e.g., "We're closed on major holidays but open most other days. Check our holiday schedule on our website."]</div>

<h3>Communication & Support</h3>

<div class="question">Q: What's the best way to contact you?</div>
<div class="answer">A: [Your answer - e.g., "WhatsApp is fastest for urgent matters: [number]. Email for non-urgent: [email]."]</div>

<div class="question">Q: How quickly do you respond to messages?</div>
<div class="answer">A: [Your answer - e.g., "We respond to WhatsApp within 2 hours during business hours, email within 24 hours."]</div>

<div class="question">Q: Can I get updates about my appointment?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we'll send you confirmation and reminder messages via WhatsApp."]</div>

<h3>Service Details</h3>

<div class="question">Q: What's included in the service?</div>
<div class="answer">A: [Your answer - e.g., "All our services include [list what's included]. Additional items can be added for extra cost."]</div>

<div class="question">Q: How long does the service take?</div>
<div class="answer">A: [Your answer - e.g., "Most services take [duration]. We'll give you a more precise estimate when you book."]</div>

<div class="question">Q: Do you offer any guarantees?</div>
<div class="answer">A: [Your answer - e.g., "We guarantee your satisfaction. If you're not happy, we'll make it right or provide a refund."]</div>

<div class="question">Q: Can I add extra services on the day?</div>
<div class="answer">A: [Your answer - e.g., "Subject to availability and time constraints. We recommend adding extras when booking."]</div>

<h3>Pricing & Payments</h3>

<div class="question">Q: Are there any hidden fees?</div>
<div class="answer">A: [Your answer - e.g., "No hidden fees. The price quoted includes everything except optional add-ons."]</div>

<div class="question">Q: Do you offer discounts?</div>
<div class="answer">A: [Your answer - e.g., "We offer 10% off for first-time customers and seasonal promotions. Ask about current offers!"]</div>

<div class="question">Q: What if the service takes longer than expected?</div>
<div class="answer">A: [Your answer - e.g., "If it's our fault, no extra charge. If you request additional work, we'll quote you first."]</div>

<h3>After Service</h3>

<div class="question">Q: What should I expect after the service?</div>
<div class="answer">A: [Your answer - e.g., "You'll receive care instructions and can contact us with any questions for 48 hours."]</div>

<div class="question">Q: Do you offer follow-up services?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we offer maintenance packages and follow-up appointments at discounted rates."]</div>

<div class="question">Q: How can I leave feedback?</div>
<div class="answer">A: [Your answer - e.g., "We'd love your feedback! Leave reviews on Google, WhatsApp us, or use our feedback form."]</div>

<h3>Problem Resolution</h3>

<div class="question">Q: What if I'm not satisfied with the service?</div>
<div class="answer">A: [Your answer - e.g., "Contact us within 24 hours. We'll work with you to resolve any issues promptly."]</div>

<div class="question">Q: What if something gets damaged?</div>
<div class="answer">A: [Your answer - e.g., "We're fully insured. Report any damage immediately and we'll handle it through our insurance."]</div>

<div class="question">Q: Who do I contact for complaints?</div>
<div class="answer">A: [Your answer - e.g., "Contact the manager directly at [contact info] for any serious concerns."]</div>

<h3>Policies & Terms</h3>

<div class="question">Q: Do you have a privacy policy?</div>
<div class="answer">A: [Your answer - e.g., "Yes, we protect your personal information. Full privacy policy available at [website/location]."]</div>

<div class="question">Q: What are your terms of service?</div>
<div class="answer">A: [Your answer - e.g., "Terms available on our website. Key points: [list 2-3 main policies]."]</div>

<div class="question">Q: Can I refer friends?</div>
<div class="answer">A: [Your answer - e.g., "Yes! Refer a friend and you both get [discount/benefit]. No limit on referrals!"]</div>

<h3>Additional Questions</h3>

<p style="font-style: italic; margin-bottom: 12pt;">Add any other questions specific to your business:</p>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="question">Q: [Your custom question]</div>
<div class="answer">A: [Your answer]</div>

<div class="tips">
<h4>💡 Tips for Completing This Template:</h4>
<ol>
<li><strong>Be Specific:</strong> Give exact details (times, prices, locations) rather than vague answers</li>
<li><strong>Be Helpful:</strong> Think from your customer's perspective - what would they want to know?</li>
<li><strong>Be Honest:</strong> Set clear expectations to avoid misunderstandings</li>
<li><strong>Update Regularly:</strong> Review and update your FAQ as your business evolves</li>
<li><strong>Test with Customers:</strong> Ask recent customers what questions they had that aren't covered</li>
</ol>

<h4>🎯 Common Mistakes to Avoid:</h4>
<ul>
<li>Don't just copy-paste generic answers</li>
<li>Don't leave placeholder text like "[Your answer]"</li>
<li>Don't skip questions that seem obvious to you (they might not be to customers)</li>
<li>Don't forget to proofread for typos and clarity</li>
</ul>

<h4>📄 How to Save as PDF:</h4>
<ol>
<li>Fill out all your answers</li>
<li>Go to File → Save As → Choose PDF format</li>
<li>Upload the PDF in the onboarding form</li>
</ol>
</div>

<div class="footer">
<strong>Template created by Skedy - Smart Booking System</strong><br>
Need help? Contact support at support@skedy.com
</div>

</body>
</html>`;
};

export const downloadFaqTemplate = (data?: FaqTemplateData): void => {
  const htmlContent = generateWordCompatibleHTML(data);
  const blob = new Blob([htmlContent], { 
    type: 'application/msword' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `FAQ-Template-${data?.businessName?.replace(/\s+/g, '-') || 'Business'}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}; 