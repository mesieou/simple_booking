import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setupBusinessAiBot, WebsiteCrawlConfig } from '@/lib/ai-setup/website-crawler';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { websiteUrl, botType, businessId } = await request.json() as WebsiteCrawlConfig;

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

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' }, 
        { status: 404 }
      );
    }

    // Setup AI Bot
    await setupBusinessAiBot({
      websiteUrl,
      botType,
      businessId
    });

    return NextResponse.json({
      message: 'AI Bot setup completed successfully',
      businessId
    });

  } catch (error) {
    console.error('AI Bot Setup Error:', error);
    return NextResponse.json(
      { error: 'Failed to setup AI Bot', details: String(error) }, 
      { status: 500 }
    );
  }
}
