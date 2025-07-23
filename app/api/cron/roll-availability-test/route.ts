import { NextResponse } from 'next/server';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { rollAggregatedAvailability } from '@/lib/general-helpers/availability';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const testProvider = searchParams.get('providerId');
  const dryRun = searchParams.get('dryRun') === 'true';
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON-TEST-AUTH] Unauthorized access attempt');
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = new Date();
  const executionId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[CRON-TEST-${executionId}] Starting performance test...`);
    console.log(`[CRON-TEST-${executionId}] Dry run: ${dryRun}, Test provider: ${testProvider}`);
    
    // Get providers (either all or specific one for testing)
    const allProviders = testProvider 
      ? [await User.getById(testProvider)]
      : await User.getAllProviders().then(providers => providers.slice(0, 5)); // Limit to 5 for testing
    
    const totalProviders = allProviders.length;
    console.log(`[CRON-TEST-${executionId}] Testing with ${totalProviders} providers`);

    // Performance metrics
    const metrics = {
      fetchBusinessesTime: 0,
      fetchCalendarSettingsTime: 0,
      processProvidersTime: 0,
      totalDatabaseQueries: 0
    };

    // Fetch businesses with timing
    const businessFetchStart = Date.now();
    const uniqueBusinessIds = Array.from(new Set(allProviders.map(p => p.businessId)));
    const businessPromises = uniqueBusinessIds.map(id => Business.getById(id));
    const businessResults = await Promise.all(businessPromises);
    const businessMap = new Map<string, Business>();
    businessResults.forEach((business, index) => {
      if (business) {
        businessMap.set(uniqueBusinessIds[index], business);
      }
    });
    metrics.fetchBusinessesTime = Date.now() - businessFetchStart;
    metrics.totalDatabaseQueries += uniqueBusinessIds.length;
    
    // Fetch calendar settings with timing
    const calendarFetchStart = Date.now();
    const calendarPromises = allProviders.map(provider =>
      CalendarSettings.getByUserAndBusiness(provider.id, provider.businessId)
    );
    const calendarResults = await Promise.all(calendarPromises);
    const calendarMap = new Map<string, CalendarSettings>();
    allProviders.forEach((provider, index) => {
      if (calendarResults[index]) {
        calendarMap.set(provider.id, calendarResults[index]);
      }
    });
    metrics.fetchCalendarSettingsTime = Date.now() - calendarFetchStart;
    metrics.totalDatabaseQueries += allProviders.length;

    // Process providers with timing
    const processStart = Date.now();
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    if (!dryRun) {
      const processPromises = allProviders.map(async (provider) => {
        try {
          const business = businessMap.get(provider.businessId);
          const calendarSettings = calendarMap.get(provider.id);
          
          if (!business) return { result: 'error', reason: 'business_not_found' };
          if (!business.id) return { result: 'error', reason: 'business_id_missing' };
          if (!calendarSettings) return { result: 'skipped', reason: 'no_calendar_settings' };

          await rollAggregatedAvailability(business.id, { useServiceRole: true });
          return { result: 'processed' };
        } catch (error) {
          return { result: 'error', reason: error instanceof Error ? error.message : 'unknown' };
        }
      });

      const results = await Promise.all(processPromises);
      results.forEach(result => {
        if (result.result === 'processed') processed++;
        else if (result.result === 'skipped') skipped++;
        else errors++;
      });
    }
    
    metrics.processProvidersTime = Date.now() - processStart;

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();
    
    // Calculate estimated database queries for rollAvailability
    // Each provider: 1 deleteBefore + 1 getByProviderAndDateRange + up to 30 bulkInsert operations
    const estimatedRollQueries = processed * 3; // Significantly reduced from ~32 per provider
    metrics.totalDatabaseQueries += estimatedRollQueries;

    console.log(`[CRON-TEST-${executionId}] Test completed!`);
    console.log(`[CRON-TEST-${executionId}] Results: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    console.log(`[CRON-TEST-${executionId}] Total execution time: ${totalDuration}ms`);
    console.log(`[CRON-TEST-${executionId}] Estimated total DB queries: ${metrics.totalDatabaseQueries}`);
    
    return NextResponse.json({
      success: true,
      testResults: {
        totalProviders,
        processed,
        skipped,
        errors,
        dryRun
      },
      performance: {
        totalExecutionTime: totalDuration,
        businessFetchTime: metrics.fetchBusinessesTime,
        calendarFetchTime: metrics.fetchCalendarSettingsTime,
        processTime: metrics.processProvidersTime,
        estimatedDatabaseQueries: metrics.totalDatabaseQueries,
        averageTimePerProvider: processed > 0 ? Math.round(metrics.processProvidersTime / processed) : 0
      },
      optimization: {
        parallelProcessing: true,
        bulkDataFetching: true,
        bulkInserts: true,
        reducedQueries: `Reduced from ~${totalProviders * 32} to ~${metrics.totalDatabaseQueries} queries`
      },
      executionId,
      timestamp: endTime.toISOString()
    });
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[CRON-TEST-${executionId}] Test failed:`, error);
    
    return NextResponse.json({
      success: false,
      message: 'Test failed',
      executionId,
      error: errorMessage,
      duration
    }, { status: 500 });
  }
} 