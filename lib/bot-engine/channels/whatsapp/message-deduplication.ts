// Message deduplication utilities for WhatsApp webhook processing
// Prevents processing the same message multiple times

// Message deduplication cache - prevents processing the same message multiple times
const processedMessages = new Map<string, number>();
const MESSAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Clean up old entries from deduplication cache
function cleanupMessageCache() {
  const now = Date.now();
  processedMessages.forEach((timestamp, messageId) => {
    if (now - timestamp > MESSAGE_CACHE_TTL) {
      processedMessages.delete(messageId);
    }
  });
}

// Check if message has already been processed
export function isMessageAlreadyProcessed(messageId: string): boolean {
  cleanupMessageCache(); // Clean up old entries first
  return processedMessages.has(messageId);
}

// Mark message as processed
export function markMessageAsProcessed(messageId: string): void {
  processedMessages.set(messageId, Date.now());
} 