import { getEnvironmentServerClient } from "@/lib/database/supabase/environment";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();
  const returnUrl = requestUrl.searchParams.get("returnUrl")?.toString();

  if (code) {
    const supabase = getEnvironmentServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Check for redirect_to first (existing functionality), then returnUrl (new functionality)
  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }
  
  if (returnUrl) {
    // Decode the return URL and redirect to it
    const decodedReturnUrl = decodeURIComponent(returnUrl);
    return NextResponse.redirect(`${origin}${decodedReturnUrl}`);
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL("/protected", request.url));
} 