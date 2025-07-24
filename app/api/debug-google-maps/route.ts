import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[DEBUG-GOOGLE-MAPS] Starting Google Maps API debug...');
    
    // Check environment variable
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const hasApiKey = !!apiKey;
    const apiKeyLength = apiKey?.length || 0;
    const apiKeyPreview = apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT_FOUND';
    
    console.log('[DEBUG-GOOGLE-MAPS] API Key check:', {
      hasApiKey,
      apiKeyLength,
      apiKeyPreview
    });

    // Test with a simple address
    const testAddress = 'Sydney, Australia';
    let googleApiTest = {
      success: false,
      error: null as string | null,
      status: null as string | null,
      resultsCount: 0
    };

    if (hasApiKey) {
      try {
        const encodedAddress = encodeURIComponent(testAddress);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
        
        console.log('[DEBUG-GOOGLE-MAPS] Making test API call...');
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('[DEBUG-GOOGLE-MAPS] API Response:', {
          status: data.status,
          resultsCount: data.results?.length || 0
        });

        googleApiTest = {
          success: data.status === 'OK',
          error: data.error_message || null,
          status: data.status,
          resultsCount: data.results?.length || 0
        };
      } catch (error) {
        console.error('[DEBUG-GOOGLE-MAPS] API call failed:', error);
        googleApiTest.error = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      googleApiTest.error = 'No API key available';
    }

    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      apiKey: {
        exists: hasApiKey,
        length: apiKeyLength,
        preview: apiKeyPreview
      },
      testCall: googleApiTest,
      allEnvVarsCount: Object.keys(process.env).length,
      googleRelatedVars: Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('google') || key.toLowerCase().includes('maps')
      )
    });

  } catch (error) {
    console.error('[DEBUG-GOOGLE-MAPS] Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV
    }, { status: 500 });
  }
} 