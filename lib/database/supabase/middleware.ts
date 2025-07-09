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
    // Use getUser() instead of getSession() for better security
    // This contacts the Supabase Auth server to verify the user is authentic
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // Only log unexpected errors, not normal "no session" cases
      if (error.message !== "Auth session missing!" && error.status !== 400) {
        console.error("Error al verificar el usuario:", error);
      }
      // Let's not redirect on error, just continue, maybe it's a temporary issue.
      // return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    const { pathname, searchParams } = request.nextUrl;

    // Check if this is a Stripe Connect callback (allow unauthenticated access)
    const isStripeCallback = pathname.startsWith("/onboarding") && 
      (searchParams.get('success') === 'true' || searchParams.get('refresh') === 'true') &&
      searchParams.get('businessId');

    // If there is a user, we need to check if the user is onboarded
    if (user) {
      console.log(`[Middleware] Session found for user: ${user.id}`);

      // Create a separate, admin client that can bypass RLS for this specific, safe query.
      // Use environment-specific variables
      const isProduction = process.env.NODE_ENV === 'production';
      
      const supabaseUrl = isProduction 
        ? (process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
        : process.env.NEXT_PUBLIC_SUPABASE_URL;
        
      const supabaseServiceKey = isProduction 
        ? (process.env.SUPABASE_PROD_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
        : (process.env.SUPABASE_DEV_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[Middleware] Missing admin client credentials:', {
          environment: isProduction ? 'production' : 'development',
          url: !!supabaseUrl,
          serviceKey: !!supabaseServiceKey
        });
        throw new Error(`Missing Supabase admin credentials for ${isProduction ? 'production' : 'development'}`);
      }

      const supabaseAdmin = createClient(
        supabaseUrl,
        supabaseServiceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from("users")
        .select("businessId, role")
        .eq("id", user.id)
        .single();
      
      if (profileError) {
        console.error("[Middleware] Error fetching user profile:", profileError.message);
      }
      console.log("[Middleware] User profile from DB:", userProfile);

      const hasBusiness = !!userProfile?.businessId;
      const isSuperAdmin = userProfile?.role === 'super_admin';
      console.log(`[Middleware] Calculated hasBusiness: ${hasBusiness}, isSuperAdmin: ${isSuperAdmin}`);

      const isOnboardingOrInvite = pathname.startsWith("/onboarding") || pathname.startsWith("/invite");

      // Case 1: User is not onboarded (no business) and is not on an onboarding page.
      // BUT superadmins don't need a business association
      if (!hasBusiness && !isSuperAdmin && !isOnboardingOrInvite) {
        console.log("[Middleware] Redirecting to /onboarding because user has no business and is not on an onboarding page.");
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }

      // Case 2: User IS onboarded (or is superadmin) and is trying to access a page they shouldn't be on.
      if ((hasBusiness || isSuperAdmin) && (pathname === "/" || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up") || pathname.startsWith("/onboarding"))) {
        console.log("[Middleware] Redirecting to /protected because user has a business (or is superadmin) and is on a public/onboarding page.");
        return NextResponse.redirect(new URL("/protected", request.url));
      }
    }

    // If there is no user and the user tries to access a protected route
    // BUT allow Stripe Connect callbacks to pass through
    if (!user && pathname.startsWith("/protected")) {
      // Preserve the original URL (including query parameters) as a return URL
      const returnUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(new URL(`/sign-in?returnUrl=${returnUrl}`, request.url));
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
