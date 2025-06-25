# Stripe Payment Integration for WhatsApp Booking Bot

This integration allows businesses to collect payments through Stripe Payment Links directly in the WhatsApp booking flow.

## Overview

The payment system implements:
- **Split Payments**: $4 goes to Skedy, remainder goes to business via Stripe Connect
- **Dynamic Payment Links**: Generated with service details, business info, and customer info
- **WhatsApp Redirects**: After payment, customers are redirected back to WhatsApp
- **Automatic Booking Creation**: Bot resumes flow and creates booking upon payment completion

## Setup

### 1. Environment Variables

Add these to your `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook endpoint secret from Stripe Dashboard

# Optional: For production, also set
STRIPE_PUBLISHABLE_KEY=pk_test_... # If you need client-side integration later
```

### 2. Stripe Connect Setup

Businesses that want to collect deposits need:

1. **Create Connected Accounts** for businesses through Stripe's API or dashboard
2. **Update Business Records** with Stripe Connect account information:
   ```typescript
   await Business.update(businessId, {
     ...businessData,
     stripeConnectAccountId: 'acct_...',
     stripeAccountStatus: 'active',
     depositPercentage: 30 // Percentage of total cost required as deposit (e.g., 30%)
   });
   ```

**Important**: Only businesses with `depositPercentage` set will show payment options. Businesses without this field will use standard quote confirmation without payment.

### 3. Stripe Webhook Configuration

1. **Create Webhook Endpoint** in Stripe Dashboard:
   - URL: `https://yourdomain.com/api/payments/stripe-webhook`
   - Events: `checkout.session.completed`, `payment_link.payment_failed`

2. **Copy Webhook Secret** to `STRIPE_WEBHOOK_SECRET` environment variable

## How It Works

### 1. Quote Summary
When users reach the quote summary step, they see:
- Service details and pricing

**If business requires deposits** (`depositPercentage` is set):
- Deposit amount (based on business.depositPercentage)
- $4 Skedy booking fee
- Total payment amount
- "Pay Deposit ($X.XX)" button

**If business doesn't require deposits** (no `depositPercentage`):
- Standard quote confirmation
- "Confirm" button (proceeds directly to booking creation)

### 2. Payment Flow
When user clicks "Pay Deposit":
1. **Payment Link Generation**: Creates Stripe Payment Link with split payment
2. **WhatsApp Message**: Sends payment link and instructions to user
3. **Payment Processing**: User completes payment on Stripe
4. **Redirect**: User is redirected back to WhatsApp with completion message
5. **Booking Creation**: Bot detects completion and creates final booking

### 3. Payment Split
- **Business receives**: Deposit amount minus $4
- **Skedy receives**: $4 application fee
- **Customer pays**: Deposit amount + $4 = Total

## API Endpoints

### Payment Link Creation
```
POST /api/payments/create-link
{
  "quoteId": "quote-uuid"
}
```

### Stripe Webhook Handler
```
POST /api/payments/stripe-webhook
```

## Testing

### 1. Test Payment Links
```bash
curl -X POST https://yourdomain.com/api/payments/create-link \
  -H "Content-Type: application/json" \
  -d '{"quoteId": "your-quote-id"}'
```

### 2. Test Webhook
Use Stripe CLI to forward webhooks to local development:
```bash
stripe listen --forward-to localhost:3000/api/payments/stripe-webhook
```

### 3. Test Payment Completion
Send this message to your WhatsApp bot:
```
PAYMENT_COMPLETED_your-quote-id
```

## Database Changes

The integration adds these fields to the `businesses` table:
- `stripeConnectAccountId`: Stripe Connect account ID
- `stripeAccountStatus`: 'pending' | 'active' | 'disabled'
- `depositPercentage`: Percentage of total cost required as deposit (default: 50%)

## Error Handling

The system handles:
- **Payment Link Creation Failures**: Shows fallback message with contact information
- **Invalid Business Setup**: Prevents payment if Stripe Connect not configured
- **Webhook Failures**: Graceful degradation with manual follow-up
- **Payment Failures**: User can retry payment

## Security Features

- **Webhook Signature Verification**: All webhooks are verified using Stripe signatures
- **Metadata Validation**: Quote IDs and business IDs are validated
- **Error Logging**: Comprehensive logging for debugging and monitoring

## Production Considerations

1. **Rate Limiting**: Consider adding rate limits to payment endpoints
2. **Monitoring**: Set up alerts for payment failures and webhook issues
3. **Backup Processing**: Implement manual payment verification for edge cases
4. **Business Onboarding**: Create flow for onboarding businesses to Stripe Connect

## Support

For payment-related issues:
1. Check Stripe Dashboard for payment status
2. Review webhook logs in your application
3. Verify business Stripe Connect account status
4. Check quote status in database

## Example Flows

### Business WITH Deposit Requirements (depositPercentage: 30)
1. Customer completes service selection and gets quote
2. Quote shows: "Service: $100, Deposit: $30, Booking fee: $4, Total: $34"
3. Customer clicks "Pay Deposit ($34)"
4. Bot sends Stripe payment link
5. Customer pays on Stripe
6. Customer is redirected back to WhatsApp
7. Bot creates booking and sends confirmation
8. Business receives $30, Skedy receives $4

### Business WITHOUT Deposit Requirements (no depositPercentage)
1. Customer completes service selection and gets quote
2. Quote shows: "Service: $100, Total: $100"
3. Customer clicks "Confirm"
4. Bot immediately creates booking and sends confirmation
5. No payment processing required 