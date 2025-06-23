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
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error al verificar la sesión:", error);
      // Let's not redirect on error, just continue, maybe it's a temporary issue.
      // return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    const { pathname } = request.nextUrl;

    // If there is a session, we need to check if the user is onboarded
    if (session) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("businessId")
        .eq("id", session.user.id)
        .single();

      const hasBusiness = !!userProfile?.businessId;
      const isOnboardingOrInvite = pathname.startsWith("/onboarding") || pathname.startsWith("/invite");

      // Case 1: User is not onboarded (no business) and is not on an onboarding page.
      if (!hasBusiness && !isOnboardingOrInvite) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }

      // Case 2: User IS onboarded and is trying to access the root, sign-in, or sign-up page.
      if (hasBusiness && (pathname === "/" || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))) {
        return NextResponse.redirect(new URL("/protected", request.url));
      }
    }

    // If there is no session and the user tries to access a protected route
    if (!session && pathname.startsWith("/protected")) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return response;
  } catch (error) {
    console.error("Error in middleware:", error);
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}
