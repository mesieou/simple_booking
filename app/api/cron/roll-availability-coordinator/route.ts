import { NextResponse } from 'next/server';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { rollAvailabilityOptimized } from '@/lib/general-helpers/availability';

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
    console.log(`[CRON-COORDINATOR-${executionId}] Starting optimized availability rollover...`);
    console.log(`[CRON-COORDINATOR-${executionId}] Trigger type: ${triggerType}`);
    
    // 1. Get all providers
    const allProviders = await User.getAllProviders();
    const totalProviders = allProviders.length;
    console.log(`[CRON-COORDINATOR-${executionId}] Found ${totalProviders} providers`);

    if (totalProviders === 0) {
      return NextResponse.json({
        success: true,
        message: 'No providers found to process',
        executionId,
        summary: {
          totalProviders: 0,
          totalProcessed: 0,
          totalSkipped: 0,
          totalErrors: 0,
          processedCount: 0,
          overallSuccess: true
        },
        executionTime: Date.now() - startTime.getTime(),
        triggerType
      });
    }

    // 2. Bulk fetch all businesses (eliminate N+1 queries)
    const uniqueBusinessIds = Array.from(new Set(allProviders.map(p => p.businessId)));
    console.log(`[CRON-COORDINATOR-${executionId}] Fetching ${uniqueBusinessIds.length} unique businesses...`);
    
    const businessPromises = uniqueBusinessIds.map(id => 
      Business.getById(id).catch(error => {
        console.error(`[CRON-COORDINATOR-${executionId}] Failed to fetch business ${id}:`, error);
        return null;
      })
    );
    const businessResults = await Promise.all(businessPromises);
    const businessMap = new Map<string, Business>();
    businessResults.forEach((business, index) => {
      if (business) {
        businessMap.set(uniqueBusinessIds[index], business);
      }
    });

    // 3. Bulk fetch all calendar settings
    console.log(`[CRON-COORDINATOR-${executionId}] Fetching calendar settings for all providers...`);
    const calendarPromises = allProviders.map(provider =>
      CalendarSettings.getByUserAndBusiness(provider.id, provider.businessId).catch(error => {
        console.error(`[CRON-COORDINATOR-${executionId}] Failed to fetch calendar settings for provider ${provider.id}:`, error);
        return null;
      })
    );
    const calendarResults = await Promise.all(calendarPromises);
    const calendarMap = new Map<string, CalendarSettings>();
    allProviders.forEach((provider, index) => {
      if (calendarResults[index]) {
        calendarMap.set(provider.id, calendarResults[index]);
      }
    });

    // 4. Process providers in optimized batches with parallel processing
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const batchSize = 10; // Increased batch size since we now have all data
    const maxExecutionTime = 55000; // Increased to 55 seconds

    const processBatch = async (batchProviders: User[]): Promise<{ processed: number; skipped: number; errors: number }> => {
      const batchPromises = batchProviders.map(async (provider) => {
        try {
          const business = businessMap.get(provider.businessId);
          if (!business) {
            console.error(`[CRON-COORDINATOR-${executionId}] Business not found for provider ${provider.id}`);
            return { result: 'error' };
          }

          const calendarSettings = calendarMap.get(provider.id);
          if (!calendarSettings) {
            console.error(`[CRON-COORDINATOR-${executionId}] Provider ${provider.id} has no calendar settings`);
            return { result: 'skipped' };
          }

                     await rollAvailabilityOptimized(provider, business, calendarSettings);
           console.log(`[CRON-COORDINATOR-${executionId}] ✅ Processed ${provider.firstName} ${provider.lastName} (${provider.id})`);
           return { result: 'processed' };

        } catch (error) {
          console.error(`[CRON-COORDINATOR-${executionId}] Failed to roll availability for provider ${provider.id}:`, error);
          return { result: 'error' };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      return batchResults.reduce((acc, result) => {
        if (result.result === 'processed') acc.processed++;
        else if (result.result === 'skipped') acc.skipped++;
        else acc.errors++;
        return acc;
      }, { processed: 0, skipped: 0, errors: 0 });
    };

    // Process all batches
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
      
      console.log(`[CRON-COORDINATOR-${executionId}] Processing batch ${batchNumber}/${totalBatches} (providers ${i + 1}-${Math.min(i + batchSize, totalProviders)}) in parallel...`);
      
      const batchResult = await processBatch(batchProviders);
      totalProcessed += batchResult.processed;
      totalSkipped += batchResult.skipped;
      totalErrors += batchResult.errors;

      const batchElapsed = Date.now() - startTime.getTime();
      console.log(`[CRON-COORDINATOR-${executionId}] ✅ Batch ${batchNumber} completed - Processed: ${batchResult.processed}, Skipped: ${batchResult.skipped}, Errors: ${batchResult.errors} (${batchElapsed}ms total elapsed)`);
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