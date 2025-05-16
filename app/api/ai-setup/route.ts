import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setupBusinessAiBot, FastCrawlConfig, CrawlProgress } from '@/lib/bot/website-crawler';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { websiteUrl, botType, businessId } = await request.json() as FastCrawlConfig;

    // Validate input
    if (!websiteUrl || !botType || !businessId) {
      return NextResponse.json(
        { error: 'Missing required parameters' }, 
        { status: 400 }
      );
    }

    // Validate business exists
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Business lookup error:', businessError);
      return NextResponse.json(
        { error: 'Failed to verify business', details: businessError.message }, 
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' }, 
        { status: 404 }
      );
    }

    // Setup AI Bot with progress tracking
    const progressCallback = (progress: CrawlProgress) => {
      console.log('Crawl progress:', {
        processed: progress.processedPages,
        total: progress.totalPages,
        percentage: progress.percentage.toFixed(1) + '%',
        currentUrl: progress.currentUrl,
        activePages: progress.activePages
      });
    };

    const crawlSession = await setupBusinessAiBot({
      websiteUrl,
      botType,
      businessId,
      logInterval: {
        urls: 5,    // Log every 5 URLs
        seconds: 2  // Log every 2 seconds
      }
    }, progressCallback);

    return NextResponse.json({
      message: 'AI Bot setup completed successfully',
      businessId,
      crawlSession
    });

  } catch (error) {
    console.error('AI Bot Setup Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to setup AI Bot', 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}
