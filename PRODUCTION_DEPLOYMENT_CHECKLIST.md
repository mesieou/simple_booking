# WhatsApp Business API - Production Deployment Checklist

## ✅ Prerequisites Completed
- [x] System User Access Token created (permanent token)
- [x] Webhook implementation ready
- [x] Bot logic implemented

## 🔧 Production Configuration Required

### 1. Environment Variables
Set these in your production environment:

```bash
# Core WhatsApp Configuration
WHATSAPP_API_VERSION=v23.0
WHATSAPP_PHONE_NUMBER_ID=<your_phone_number_id>        # From WABA dashboard
WHATSAPP_VERIFY_TOKEN=<your_system_user_token>         # Your permanent System User token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<secure_random_string>   # For webhook verification (different from access token)
WHATSAPP_APP_SECRET=<your_app_secret>                  # For webhook signature verification
USE_WABA_WEBHOOK=true                                  # Enable webhook in production

# Database & Other Services
DATABASE_URL=<your_production_database_url>
REDIS_URL=<your_redis_url>                            # For rate limiting (recommended)
```

### 2. Meta Business Suite Configuration

#### A. Business Asset Access (CRITICAL)
1. Sign into [Meta Business Suite](https://business.facebook.com)
2. Go to your business portfolio → **Settings** (gear icon)
3. Navigate to **Accounts** → **WhatsApp Accounts**
4. Select your WABA (WhatsApp Business Account)
5. Go to **WhatsApp Account Access** tab
6. Click **+Add people**
7. Select your system user and assign **Full** access
8. Wait 5-10 minutes for permissions to propagate

#### B. Webhook Configuration
1. Go to [App Dashboard](https://developers.facebook.com/apps)
2. Navigate to WhatsApp → Configuration
3. Add webhook URL: `https://yourdomain.com/api/webhook2`
4. Set verify token: `<same_as_WHATSAPP_WEBHOOK_VERIFY_TOKEN>`
5. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `message_deliveries` 
   - ✅ `message_reads`

### 3. Production Security Enhancements ✅

Your webhook now includes:
- ✅ Webhook signature verification
- ✅ Rate limiting (200 requests/hour per WABA)
- ✅ IP-based throttling
- ✅ Enhanced error handling

### 4. Domain & SSL Requirements
- ✅ HTTPS domain (required by WhatsApp)
- ✅ Valid SSL certificate
- ✅ Publicly accessible webhook endpoint

### 5. Testing Checklist

#### A. Webhook Verification Test
```bash
# Test webhook verification
curl -X GET "https://yourdomain.com/api/webhook2?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=<your_verify_token>"
# Expected: Should return "test123"
```

#### B. Message Flow Test
1. Send a message to your WhatsApp Business number
2. Check logs for incoming webhook payload
3. Verify bot response is sent back
4. Test interactive buttons/lists

#### C. Rate Limiting Test
```bash
# Test rate limiting (should return 429 after limit)
for i in {1..205}; do
  curl -X POST "https://yourdomain.com/api/webhook2" \
    -H "Content-Type: application/json" \
    -d '{"test": "rate_limit_test"}'
done
```

### 6. Monitoring & Alerts

#### Production Monitoring Setup:
- ✅ Error rate monitoring
- ✅ Response time tracking
- ✅ Rate limit monitoring
- ✅ Webhook delivery success rate

#### Key Metrics to Track:
- Message processing success rate
- Average response time
- Webhook signature verification failures
- Rate limit hits

### 7. App Review Process (If Required)

For apps accessing data from multiple businesses, you may need:
- App Review submission
- Data Use Checkup
- Business verification

### 8. Rate Limits (Production)

Your current limits:
- **Basic WABA**: 200 calls/hour per WABA
- **Active WABA** (with registered phone): 5,000 calls/hour per WABA
- **Credit Line APIs**: 5,000 calls/hour per app

### 9. Go-Live Steps

1. **Environment Setup**
   - [ ] Deploy to production environment
   - [ ] Set all environment variables
   - [ ] Test database connections

2. **Meta Configuration**
   - [ ] Configure business asset access
   - [ ] Set production webhook URL
   - [ ] Test webhook verification

3. **Final Testing**
   - [ ] End-to-end message flow test
   - [ ] Interactive button/list test
   - [ ] Error handling test
   - [ ] Rate limiting test

4. **Monitoring**
   - [ ] Set up error alerts
   - [ ] Configure performance monitoring
   - [ ] Test escalation notifications

## 🚨 Common Production Issues

### Issue: "Error 200 - Insufficient permissions"
**Solution**: Check business asset access configuration

### Issue: Webhook verification fails
**Solution**: Ensure `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches Meta configuration

### Issue: Messages not sending
**Solution**: Verify `WHATSAPP_VERIFY_TOKEN` is the System User token, not webhook token

### Issue: Rate limiting errors
**Solution**: Implement exponential backoff and request queuing

## 📞 Emergency Contacts
- Admin escalation number: `+61450549485` (configured in your code)
- WhatsApp Business Support: [business.whatsapp.com/support](https://business.whatsapp.com/support)

---
*Last updated: Production deployment checklist for simple_booking WhatsApp integration* 