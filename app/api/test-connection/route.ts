import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("Probando conexión con Supabase...");
    console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + "...");
    
    const supabase = await createClient();
    
    // Intentar obtener la sesión actual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Error al obtener sesión:", sessionError);
      return NextResponse.json({ 
        success: false, 
        error: sessionError.message,
        details: "Error al obtener sesión"
      });
    }

    // Obtener información de autenticación
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error al obtener usuario:", authError);
      return NextResponse.json({ 
        success: false, 
        error: authError.message,
        details: "Error al obtener usuario"
      });
    }

    // Verificar la configuración de autenticación
    const { data: authConfig, error: configError } = await supabase.auth.getSession();

    return NextResponse.json({ 
      success: true, 
      message: "Conexión exitosa con Supabase",
      config: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + "...",
        session: session ? "Sesión activa" : "Sin sesión",
        user: authData.user ? {
          id: authData.user.id,
          email: authData.user.email,
          role: authData.user.role,
          last_sign_in: authData.user.last_sign_in_at
        } : null,
        error: authError
      }
    });

  } catch (error) {
    console.error("Error inesperado:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Error inesperado al conectar con Supabase",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
} 