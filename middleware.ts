import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/database/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Skip middleware for API routes to avoid blocking webhooks
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return;
  }
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - api routes (handled separately above)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
