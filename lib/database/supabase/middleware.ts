import { createClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/database/supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = await createSSRClient();

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Error al verificar la sesión:", error);
      // Let's not redirect on error, just continue, maybe it's a temporary issue.
      // return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    const { pathname, searchParams } = request.nextUrl;

    // Check if this is a Stripe Connect callback (allow unauthenticated access)
    const isStripeCallback = pathname.startsWith("/onboarding") && 
      (searchParams.get('success') === 'true' || searchParams.get('refresh') === 'true') &&
      searchParams.get('businessId');

    // If there is a session, we need to check if the user is onboarded
    if (session) {
      console.log(`[Middleware] Session found for user: ${session.user.id}`);

      // Create a separate, admin client that can bypass RLS for this specific, safe query.
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from("users")
        .select("businessId")
        .eq("id", session.user.id)
        .single();
      
      if (profileError) {
        console.error("[Middleware] Error fetching user profile:", profileError.message);
      }
      console.log("[Middleware] User profile from DB:", userProfile);

      const hasBusiness = !!userProfile?.businessId;
      console.log(`[Middleware] Calculated hasBusiness: ${hasBusiness}`);

      const isOnboardingOrInvite = pathname.startsWith("/onboarding") || pathname.startsWith("/invite");

      // Case 1: User is not onboarded (no business) and is not on an onboarding page.
      if (!hasBusiness && !isOnboardingOrInvite) {
        console.log("[Middleware] Redirecting to /onboarding because user has no business and is not on an onboarding page.");
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }

      // Case 2: User IS onboarded and is trying to access a page they shouldn't be on.
      if (hasBusiness && (pathname === "/" || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up") || pathname.startsWith("/onboarding"))) {
        console.log("[Middleware] Redirecting to /protected because user has a business and is on a public/onboarding page.");
        return NextResponse.redirect(new URL("/protected", request.url));
      }
    }

    // If there is no session and the user tries to access a protected route
    // BUT allow Stripe Connect callbacks to pass through
    if (!session && pathname.startsWith("/protected")) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Allow Stripe Connect callbacks to bypass authentication
    if (isStripeCallback) {
      return response;
    }

    return response;
  } catch (error) {
    console.error("Error in middleware:", error);
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}
