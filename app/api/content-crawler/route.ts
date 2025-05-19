import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { crawlAndMergeText } from '@/lib/bot/content-crawler/crawler';
import { processPdfAndCreateEmbeddings } from '@/lib/bot/content-crawler/crawler';
import { SimpleCrawlConfig, PdfProcessingConfig } from '@/lib/bot/content-crawler/types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { type, businessId, websiteUrl, pdfBuffer, originalUrl } = body;

    console.log('Received request body:', body);
    console.log('Received type:', type);

    // Validate input
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

    let result;
    if (type === 'website') {
      console.log('Executing website crawl branch');
      // Validate website URL
      if (!websiteUrl) {
        return NextResponse.json(
          { error: 'Missing required parameter: websiteUrl' }, 
          { status: 400 }
        );
      }

      // Run website crawl
      const config: SimpleCrawlConfig = {
        websiteUrl,
        businessId
      };
      result = await crawlAndMergeText(config);
    } 
    else if (type === 'pdf') {
      console.log('Executing PDF processing branch');
      // Validate PDF buffer
      if (!pdfBuffer) {
        return NextResponse.json(
          { error: 'Missing required parameter: pdfBuffer' }, 
          { status: 400 }
        );
      }

      // Process PDF
      const config: PdfProcessingConfig = {
        businessId,
        originalUrl
      };
      result = await processPdfAndCreateEmbeddings(pdfBuffer, config);
    }
    else {
      console.log('Executing invalid type branch');
      return NextResponse.json(
        { error: 'Invalid type. Must be either "website" or "pdf"' }, 
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Content processing and embedding completed successfully',
      businessId,
      result
    });

  } catch (error) {
    console.error('Content Processing Error:', error);
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
