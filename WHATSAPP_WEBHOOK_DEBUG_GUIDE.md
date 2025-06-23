# WhatsApp Webhook Debugging Guide

## 🚨 Issue: Webhook not receiving POST requests at /api/webhook2

This guide will help you debug why your WhatsApp webhook isn't receiving POST requests from Meta/WhatsApp.

## 🔧 Debugging Steps Implemented

### 1. ✅ Enhanced Logging Added
- **File**: `app/api/webhook2/route.ts`
- **What**: Added comprehensive logging at the start of POST handler
- **Logs**: All headers, body, user agent, IP, and request details
- **Check**: Look for `[Juan-Bot Webhook PROD] ===== WEBHOOK DEBUG START =====` in Vercel logs

### 2. ✅ Route Verification
- **Webhook URL**: `https://skedy.io/api/webhook2`
- **Meta Callback URL**: Should match exactly in Meta Business Suite
- **Verification**: Test with `GET /api/webhook2?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=YOUR_TOKEN`

### 3. ✅ CORS/Middleware Fix
- **File**: `middleware.ts`
- **Fix**: Excluded API routes from authentication middleware
- **Why**: Prevents blocking webhook requests from Meta/WhatsApp

### 4. ✅ Test Endpoints Created
- **Test Page**: `https://skedy.io/test-whatsapp`
- **API Endpoints**:
  - `GET /api/test-whatsapp` - Check configuration
  - `POST /api/test-whatsapp` - Send template message
  - `GET /api/webhook-status` - Check webhook status
  - `POST /api/webhook-status` - Echo test

### 5. ✅ WhatsApp API Test
- **Function**: `getWhatsappHeaders()` helper
- **Token**: Uses `WHATSAPP_PERMANENT_TOKEN`
- **Test**: Send template messages to verify API connection

## 🕵️ Step-by-Step Debugging

### Step 1: Check Vercel Logs
1. Go to your Vercel dashboard
2. Navigate to Functions → `/api/webhook2`
3. Look for POST request logs
4. Check for any 403, 404, or 500 errors

### Step 2: Test Webhook Accessibility
```bash
# Test webhook verification
curl -X GET "https://skedy.io/api/webhook2?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=YOUR_TOKEN"

# Test webhook status
curl -X GET "https://skedy.io/api/webhook-status"

# Test webhook echo
curl -X POST "https://skedy.io/api/webhook-status" \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook_test"}'
```

### Step 3: Test WhatsApp API Connection
```bash
# Test configuration
curl -X GET "https://skedy.io/api/test-whatsapp"

# Send template message
curl -X POST "https://skedy.io/api/test-whatsapp" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "34612345678", "templateName": "hello_world"}'
```

### Step 4: Verify Meta Configuration
1. Go to [Meta Business Suite](https://business.facebook.com)
2. Navigate to WhatsApp → Configuration
3. Verify webhook URL: `https://skedy.io/api/webhook2`
4. Check verify token matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
5. Ensure webhook fields are subscribed:
   - ✅ `messages`
   - ✅ `message_deliveries`
   - ✅ `message_reads`

### Step 5: Check Environment Variables
Ensure these are set in your `.env.local` and Vercel:
```bash
USE_WABA_WEBHOOK=true
WHATSAPP_API_VERSION=v23.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_PERMANENT_TOKEN=your_permanent_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_APP_SECRET=your_app_secret
```

## 🔍 Common Issues & Solutions

### Issue 1: No POST requests in logs
**Possible Causes**:
- Webhook URL incorrect in Meta
- Webhook disabled (`USE_WABA_WEBHOOK=false`)
- DNS/SSL issues
- Firewall blocking Meta IPs

**Solutions**:
- Verify webhook URL in Meta Business Suite
- Check `USE_WABA_WEBHOOK` environment variable
- Test webhook verification endpoint
- Check SSL certificate validity

### Issue 2: 403 Forbidden errors
**Possible Causes**:
- Middleware blocking requests
- Rate limiting
- Invalid webhook signature

**Solutions**:
- Middleware now excludes API routes ✅
- Check rate limiting logs
- Verify `WHATSAPP_APP_SECRET` for signature verification

### Issue 3: 500 Internal Server Error
**Possible Causes**:
- Missing environment variables
- Database connection issues
- Code errors in webhook handler

**Solutions**:
- Check all required environment variables
- Verify database connectivity
- Review webhook handler logs

### Issue 4: Webhook verification fails
**Possible Causes**:
- Wrong verify token
- Incorrect webhook URL
- Meta configuration issues

**Solutions**:
- Verify `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches Meta
- Check webhook URL format
- Re-verify webhook in Meta Business Suite

## 📊 Monitoring Checklist

### Vercel Logs to Monitor
- [ ] POST requests to `/api/webhook2`
- [ ] Webhook signature verification
- [ ] Rate limiting hits
- [ ] Error responses (403, 404, 500)
- [ ] WhatsApp API responses

### Meta Business Suite to Check
- [ ] Webhook status (active/inactive)
- [ ] Webhook delivery success rate
- [ ] Error logs in webhook configuration
- [ ] Phone number status

### Environment Variables to Verify
- [ ] `USE_WABA_WEBHOOK=true`
- [ ] `WHATSAPP_PHONE_NUMBER_ID` set
- [ ] `WHATSAPP_PERMANENT_TOKEN` set
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` set
- [ ] `WHATSAPP_APP_SECRET` set

## 🚀 Next Steps

1. **Deploy changes** to Vercel
2. **Test webhook endpoints** using the test page
3. **Monitor Vercel logs** for incoming requests
4. **Verify Meta configuration** is correct
5. **Send test message** to your WhatsApp number
6. **Check logs** for webhook processing

## 📞 Support

If issues persist after following this guide:
1. Check Vercel function logs for detailed error messages
2. Verify all environment variables are correctly set
3. Test with the provided test endpoints
4. Review Meta Business Suite webhook configuration
5. Ensure your WhatsApp Business Account is properly configured 