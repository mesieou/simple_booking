import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/supabase/server';
import { CrawlConfig } from '@/lib/general-config/general-config';
import { crawlAndProcess } from '@/lib/backend-actions/content-crawler/html-crawler';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { type, businessId, websiteUrl } = body;

    // Early validation
    if (!type || !businessId) {
      return NextResponse.json(
        { error: 'Missing required parameters: type and businessId are required' },
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

    // Handle type
    switch (type) {
      case 'website': {
        if (!websiteUrl) {
          return NextResponse.json(
            { error: 'Missing required parameter: websiteUrl' },
            { status: 400 }
          );
        }
        const config: CrawlConfig = { websiteUrl, businessId, type: 'website_page' };
        const result = await crawlAndProcess(config);
        return NextResponse.json({
          message: 'Content processing and embedding completed successfully',
          businessId,
          result
        });
      }
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be "website"' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to process content and create embeddings',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
