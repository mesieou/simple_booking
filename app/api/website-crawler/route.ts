import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { crawlAndMergeText, ExtendedCrawlConfig } from '@/lib/bot/website-crawler/crawler';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { websiteUrl, businessId } = await request.json();

    // Validate input
    if (!websiteUrl || !businessId) {
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

    // Run crawl, auto-categorization, and embeddings
    const crawlResult = await crawlAndMergeText({
      websiteUrl,
      businessId
    });

    return NextResponse.json({
      message: 'Crawl and embedding completed successfully',
      businessId,
      crawlResult
    });

  } catch (error) {
    console.error('Crawl Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to crawl and embed website', 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}
