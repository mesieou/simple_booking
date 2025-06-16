import { NextResponse } from 'next/server';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { rollAvailability } from '@/lib/general-helpers/availability';

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
    
    // Get all providers and process them directly (no internal API calls)
    const allProviders = await User.getAllProviders();
    const totalProviders = allProviders.length;
    const batchSize = 5; // Process 5 providers per batch - direct processing is much faster
    
    console.log(`[CRON-COORDINATOR-${executionId}] Found ${totalProviders} providers, processing in batches of ${batchSize}`);
    
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const maxExecutionTime = 50000; // 50 seconds - safety margin for Vercel
    
    // Process providers in batches directly (much faster than API calls)
    for (let i = 0; i < totalProviders; i += batchSize) {
      const elapsedTime = Date.now() - startTime.getTime();
      
      // Check if we're approaching timeout
      if (elapsedTime > maxExecutionTime) {
        console.warn(`[CRON-COORDINATOR-${executionId}] Stopping early to avoid timeout. Processed ${totalProcessed}/${totalProviders} providers`);
        break;
      }
      
      const batchProviders = allProviders.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(totalProviders / batchSize);
      
      console.log(`[CRON-COORDINATOR-${executionId}] Processing batch ${batchNumber}/${totalBatches} (providers ${i + 1}-${Math.min(i + batchSize, totalProviders)})`);
      
      // Process this batch of providers directly
      for (const provider of batchProviders) {
        try {
          const business = await Business.getById(provider.businessId);
          if (!business) {
            console.error(`[CRON-COORDINATOR-ERROR] Business not found for provider ${provider.id}`);
            totalErrors++;
            continue;
          }
          
          const calendarSettings = await CalendarSettings.getByUserAndBusiness(
            provider.id,
            provider.businessId
          );
          
          if (!calendarSettings) {
            console.error(`[CRON-COORDINATOR-ERROR] Provider ${provider.id} has no calendar settings`);
            totalSkipped++;
            continue;
          }
          
          await rollAvailability(provider, business);
          totalProcessed++;
          console.log(`[CRON-COORDINATOR-${executionId}] ✅ Processed ${provider.firstName} ${provider.lastName} (${provider.id})`);
          
        } catch (error) {
          console.error(`[CRON-COORDINATOR-ERROR] Failed to roll availability for provider ${provider.id}:`, error);
          totalErrors++;
        }
      }
      
      const batchElapsed = Date.now() - startTime.getTime();
      console.log(`[CRON-COORDINATOR-${executionId}] ✅ Batch ${batchNumber} completed (${batchElapsed}ms total elapsed)`);
    }
    
    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();
    
    console.log(`[CRON-COORDINATOR-${executionId}] ✅ Processing completed!`);
    console.log(`[CRON-COORDINATOR-${executionId}] Final results: ${totalProcessed} processed, ${totalSkipped} skipped, ${totalErrors} errors`);
    console.log(`[CRON-COORDINATOR-${executionId}] Total execution time: ${totalDuration}ms`);
    
    const overallSuccess = totalErrors === 0;
    const processedCount = totalProcessed + totalSkipped; // Include skipped as "handled"
    
    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess 
        ? `All ${processedCount} providers processed successfully`
        : `${totalProcessed} processed, ${totalSkipped} skipped, ${totalErrors} errors`,
      executionId,
      summary: {
        totalProviders,
        totalProcessed,
        totalSkipped,
        totalErrors,
        processedCount,
        overallSuccess
      },
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