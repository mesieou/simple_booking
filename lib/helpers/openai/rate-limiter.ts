// Rate limiter for OpenAI API calls
const RATE_LIMIT = {
  maxRequestsPerMinute: 20, // Example: Reduced for testing, adjust as needed
  maxTokensPerMinute: 160000, // text-embedding-3-small is efficient
  backoffBase: 1000, // ms
  maxBackoff: 30000, // ms
  maxConcurrent: 5, 
};

let requestCounters: Array<{ timestamp: number, tokens: number }> = [];
let activeRequests = 0;

// --- Helper to manage request timestamps and token counts for rate limiting ---
function recordRequest(tokens: number) {
    const now = Date.now();
    requestCounters.push({ timestamp: now, tokens });
    // Filter out requests older than 1 minute
    requestCounters = requestCounters.filter(req => now - req.timestamp < 60000);
}

function getCurrentLoad(): { requestsInLastMinute: number, tokensInLastMinute: number } {
    const now = Date.now();
    const recentRequests = requestCounters.filter(req => now - req.timestamp < 60000);
    const requestsInLastMinute = recentRequests.length;
    const tokensInLastMinute = recentRequests.reduce((sum, req) => sum + req.tokens, 0);
    return { requestsInLastMinute, tokensInLastMinute };
}


interface QueuedRequest<T = any> {
  task: () => Promise<T>  ;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  tokens: number; // Assuming each task knows roughly how many tokens it might consume for rate limiting
}

const requestQueue: Array<QueuedRequest<any>> = [];
let isProcessingQueue = false;

// Function to be called by tasks wanting to be rate-limited
export function scheduleTask<T>(task: () => Promise<T>, estimatedTokens: number = 100): Promise<T> { // Default tokens if not specified
  return new Promise<T>((resolve, reject) => {
    requestQueue.push({ task, resolve, reject, tokens: estimatedTokens });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const { requestsInLastMinute, tokensInLastMinute } = getCurrentLoad();

    if (activeRequests >= RATE_LIMIT.maxConcurrent) {
      // console.log(`[RateLimiter] Max concurrent reached (${activeRequests}). Waiting...`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.backoffBase));
      isProcessingQueue = false; // Allow another trigger if needed
      processQueue(); // Re-check conditions
      return; 
    }

    if (requestsInLastMinute >= RATE_LIMIT.maxRequestsPerMinute) {
      // console.log(`[RateLimiter] Max requests/min reached (${requestsInLastMinute}). Waiting...`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.backoffBase)); // Simple wait
      isProcessingQueue = false;
      processQueue();
      return;
    }
    
    const nextTaskTokens = requestQueue[0].tokens; // Peek at next task's token estimate
    if (tokensInLastMinute + nextTaskTokens > RATE_LIMIT.maxTokensPerMinute) {
      // console.log(`[RateLimiter] Max tokens/min reached (${tokensInLastMinute} + ${nextTaskTokens}). Waiting...`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.backoffBase)); // Simple wait
      isProcessingQueue = false;
      processQueue();
      return;
    }

    const queuedItem = requestQueue.shift();
    if (!queuedItem) {
      isProcessingQueue = false; // Should not happen if length > 0, but good guard
      return;
    }

    activeRequests++;
    recordRequest(queuedItem.tokens); // Record it as starting now
    console.log(`[RateLimiter] Starting task. Active: ${activeRequests}, Queue: ${requestQueue.length}. RPM: ${requestsInLastMinute + 1}, TPM: ${tokensInLastMinute + queuedItem.tokens}`);

    queuedItem.task()
      .then(queuedItem.resolve)
      .catch(queuedItem.reject) // This ensures the original promise from scheduleTask is rejected
      .finally(() => {
        activeRequests--;
        console.log(`[RateLimiter] Finished task. Active: ${activeRequests}`);
        // Immediately try to process next if queue has items
        // This ensures the queue keeps flowing as slots/limits free up.
        // Set isProcessingQueue to false before calling processQueue to allow re-entry if needed.
        isProcessingQueue = false; 
        processQueue(); 
      });
  }
  
  // If queue is now empty
  isProcessingQueue = false;
  if (activeRequests === 0) {
    console.log('[RateLimiter] Queue is empty and all active tasks finished.');
  }
} 