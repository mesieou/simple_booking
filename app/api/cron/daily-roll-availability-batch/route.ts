import { NextResponse } from 'next/server';
import { rollAvailability } from '@/lib/general-helpers/availability';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  const { searchParams } = new URL(request.url);
  
  // Get batch parameters
  const batchSize = parseInt(searchParams.get('batchSize') || '5');
  const batchIndex = parseInt(searchParams.get('batchIndex') || '0');
  
  const triggerType = userAgent.includes('vercel-cron') ? 'cron' : 'manual';
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(`[CRON-BATCH-AUTH] Unauthorized access attempt. Trigger: ${triggerType}`);
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = new Date();
  const executionId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[CRON-BATCH-${executionId}] Starting batch availability roll...`);
    console.log(`[CRON-BATCH-${executionId}] Batch size: ${batchSize}, Batch index: ${batchIndex}`);
    
    // Get all providers
    const allProviders = await User.getAllProviders();
    const totalProviders = allProviders.length;
    
    // Calculate batch boundaries
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalProviders);
    const batchProviders = allProviders.slice(startIndex, endIndex);
    
    console.log(`[CRON-BATCH-${executionId}] Processing providers ${startIndex + 1}-${endIndex} of ${totalProviders} total`);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process this batch of providers
    for (const provider of batchProviders) {
      try {
        const business = await Business.getById(provider.businessId);
        if (!business) {
          console.error(`[CRON-BATCH-ERROR] Business not found for provider ${provider.id}`);
          errors++;
          continue;
        }
        
        const calendarSettings = await CalendarSettings.getByUserAndBusiness(
          provider.id,
          provider.businessId
        );
        
        if (!calendarSettings) {
          console.error(`[CRON-BATCH-ERROR] Provider ${provider.id} has no calendar settings`);
          skipped++;
          continue;
        }
        
        await rollAvailability(provider, business);
        processed++;
        console.log(`[CRON-BATCH-${executionId}] ✅ Processed provider ${provider.id} (${provider.firstName} ${provider.lastName})`);
        
      } catch (error) {
        console.error(`[CRON-BATCH-ERROR] Failed to roll availability for provider ${provider.id}:`, error);
        errors++;
      }
    }
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const isLastBatch = endIndex >= totalProviders;
    const nextBatchIndex = isLastBatch ? null : batchIndex + 1;
    
    console.log(`[CRON-BATCH-${executionId}] ✅ Batch completed in ${duration}ms`);
    console.log(`[CRON-BATCH-${executionId}] Results: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Batch ${batchIndex + 1} completed successfully`,
      executionId,
      batch: {
        index: batchIndex,
        size: batchSize,
        processedInBatch: processed,
        skippedInBatch: skipped,
        errorsInBatch: errors,
        isLastBatch,
        nextBatchIndex
      },
      progress: {
        providersProcessed: `${endIndex}/${totalProviders}`,
        percentComplete: Math.round((endIndex / totalProviders) * 100),
        totalProviders
      },
      executionTime: duration,
      triggerType,
      nextBatchUrl: nextBatchIndex !== null 
        ? `/api/cron/daily-roll-availability-batch?batchSize=${batchSize}&batchIndex=${nextBatchIndex}`
        : null
    });
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[CRON-BATCH-${executionId}] ❌ Batch failed:`, error);
    
    return NextResponse.json({
      success: false,
      message: 'Batch processing failed',
      executionId,
      error: errorMessage,
      duration,
      triggerType
    }, { status: 500 });
  }
} 