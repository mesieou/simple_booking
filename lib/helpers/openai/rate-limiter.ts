// Rate limiter for OpenAI API calls
const RATE_LIMIT = {
  maxRequestsPerMinute: 20,
  maxTokensPerMinute: 16000,
  backoffBase: 1000,
  maxBackoff: 30000,
  maxConcurrent: 5, // Maximum number of concurrent requests
};

let requestCount = 0;
let tokenCount = 0;
let lastResetTime = Date.now();
let activeRequests = 0;

async function checkRateLimit(tokens: number): Promise<void> {
  const now = Date.now();
  if (now - lastResetTime >= 60000) {
    requestCount = 0;
    tokenCount = 0;
    lastResetTime = now;
  }

  // Wait if we've hit rate limits
  while (
    requestCount >= RATE_LIMIT.maxRequestsPerMinute ||
    tokenCount + tokens >= RATE_LIMIT.maxTokensPerMinute ||
    activeRequests >= RATE_LIMIT.maxConcurrent
  ) {
    const waitTime = Math.min(
      RATE_LIMIT.maxBackoff,
      RATE_LIMIT.backoffBase * Math.pow(2, requestCount)
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    
    // Reset counters if a minute has passed
    if (Date.now() - lastResetTime >= 60000) {
      requestCount = 0;
      tokenCount = 0;
      lastResetTime = Date.now();
    }
  }

  requestCount++;
  tokenCount += tokens;
  activeRequests++;
}

// Queue system for ordered processing
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;

export function pushToQueue(request: () => Promise<any>) {
  requestQueue.push(request);
  processQueue();
}

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const batch = requestQueue.splice(0, RATE_LIMIT.maxConcurrent);
    const promises = batch.map(async (request) => {
      try {
        await request();
      } catch (error) {
        console.error('Error processing queued request:', error);
      } finally {
        activeRequests--;
      }
    });

    await Promise.all(promises);
  }

  isProcessingQueue = false;
} 