import { NextResponse } from 'next/server';
import { User } from '@/lib/database/models/user';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  
  const triggerType = userAgent.includes('vercel-cron') ? 'cron' : 'manual';
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(`[CRON-COORDINATOR-AUTH] Unauthorized access attempt. Trigger: ${triggerType}`);
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = new Date();
  const executionId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[CRON-COORDINATOR-${executionId}] Starting dynamic availability rollover...`);
    console.log(`[CRON-COORDINATOR-${executionId}] Trigger type: ${triggerType}`);
    
    // Get total number of providers to determine batches needed
    const allProviders = await User.getAllProviders();
    const totalProviders = allProviders.length;
    const batchSize = 3; // Process 3 providers per batch (for Vercel timeout limits)
    const totalBatches = Math.ceil(totalProviders / batchSize);
    
    console.log(`[CRON-COORDINATOR-${executionId}] Found ${totalProviders} providers, need ${totalBatches} batches`);
    
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const batchResults = [];
    
    // Process all batches sequentially
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStartTime = Date.now();
      
      try {
        console.log(`[CRON-COORDINATOR-${executionId}] Processing batch ${batchIndex + 1}/${totalBatches}...`);
        
        // Make internal API call to batch processor
        const batchUrl = `${request.url.split('/api/')[0]}/api/cron/daily-roll-availability-batch?batchSize=${batchSize}&batchIndex=${batchIndex}`;
        
        const batchResponse = await fetch(batchUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'User-Agent': 'cron-coordinator-internal'
          }
        });
        
        if (!batchResponse.ok) {
          throw new Error(`Batch ${batchIndex} failed with status ${batchResponse.status}`);
        }
        
        const batchData = await batchResponse.json();
        const batchDuration = Date.now() - batchStartTime;
        
        totalProcessed += batchData.batch.processedInBatch;
        totalSkipped += batchData.batch.skippedInBatch;
        totalErrors += batchData.batch.errorsInBatch;
        
        batchResults.push({
          batchIndex,
          processed: batchData.batch.processedInBatch,
          skipped: batchData.batch.skippedInBatch,
          errors: batchData.batch.errorsInBatch,
          duration: batchDuration,
          success: true
        });
        
        console.log(`[CRON-COORDINATOR-${executionId}] ✅ Batch ${batchIndex + 1} completed: ${batchData.batch.processedInBatch} processed, ${batchData.batch.skippedInBatch} skipped, ${batchData.batch.errorsInBatch} errors (${batchDuration}ms)`);
        
        // Small delay between batches to avoid overwhelming the system
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (batchError) {
        const batchDuration = Date.now() - batchStartTime;
        console.error(`[CRON-COORDINATOR-${executionId}] ❌ Batch ${batchIndex + 1} failed:`, batchError);
        
        batchResults.push({
          batchIndex,
          processed: 0,
          skipped: 0,
          errors: batchSize, // Assume all providers in batch failed
          duration: batchDuration,
          success: false,
          error: batchError instanceof Error ? batchError.message : 'Unknown error'
        });
        
        totalErrors += batchSize;
      }
    }
    
    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();
    
    console.log(`[CRON-COORDINATOR-${executionId}] ✅ All batches completed!`);
    console.log(`[CRON-COORDINATOR-${executionId}] Final results: ${totalProcessed} processed, ${totalSkipped} skipped, ${totalErrors} errors`);
    console.log(`[CRON-COORDINATOR-${executionId}] Total execution time: ${totalDuration}ms`);
    
    const successfulBatches = batchResults.filter(b => b.success).length;
    const overallSuccess = successfulBatches === totalBatches;
    
    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess 
        ? `All ${totalBatches} batches completed successfully`
        : `${successfulBatches}/${totalBatches} batches succeeded`,
      executionId,
      summary: {
        totalProviders,
        totalBatches,
        batchSize,
        totalProcessed,
        totalSkipped,
        totalErrors,
        successfulBatches,
        overallSuccess
      },
      batchResults,
      executionTime: totalDuration,
      triggerType,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[CRON-COORDINATOR-${executionId}] ❌ Coordinator failed:`, error);
    
    return NextResponse.json({
      success: false,
      message: 'Coordinator failed',
      executionId,
      error: errorMessage,
      duration,
      triggerType
    }, { status: 500 });
  }
} 