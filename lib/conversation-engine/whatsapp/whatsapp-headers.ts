/**
 * Shared helper functions for WhatsApp API headers
 */

/**
 * Returns the standard headers object for WhatsApp API requests
 * Uses WHATSAPP_ACCESS_TOKEN for Authorization
 */
export const getWhatsappHeaders = (): Record<string, string> => {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  
  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN environment variable is required for WhatsApp API requests");
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Returns headers for webhook verification (uses different token)
 * Uses WHATSAPP_VERIFY_TOKEN for webhook verification
 */
export const getWebhookVerifyHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json'
  };
}; 