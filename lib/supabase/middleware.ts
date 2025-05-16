import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error al verificar la sesión:", error);
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Si no hay sesión y la ruta es protegida, redirigir a sign-in
    if (!session && request.nextUrl.pathname.startsWith("/protected")) {
      console.log("No hay sesión activa, redirigiendo a sign-in");
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Si hay sesión y estamos en la raíz, redirigir a protected
    if (session && request.nextUrl.pathname === "/") {
      console.log("Sesión activa, redirigiendo a protected");
      return NextResponse.redirect(new URL("/protected", request.url));
    }

    return response;
  } catch (error) {
    console.error("Error en el middleware:", error);
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}
