// Filename: supabase/functions/link-user-to-business/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // This is needed for browser clients which send a preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { businessId } = await req.json();

    // Create a Supabase client with the user's auth token
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Get the currently logged-in user's data
    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Create an ADMIN client to bypass RLS for the update
    const adminSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Check if the user is already in a business
    const { data: existingProfile, error: profileError } = await adminSupabaseClient
      .from('users')
      .select('businessId')
      .eq('id', user.id)
      .single();

    if (profileError || !existingProfile) {
      return new Response(JSON.stringify({ error: 'User profile not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (existingProfile.businessId) {
      return new Response(JSON.stringify({ error: 'User is already linked to a business.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 3. Update the user's profile with the new businessId and set their role
    const { error: updateError } = await adminSupabaseClient
      .from('users')
      .update({ businessId: businessId, role: 'provider' })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ message: 'Successfully linked to business!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});