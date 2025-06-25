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

    // 2. Verify the business exists and fetch required info
    const { data: business, error: businessError } = await adminSupabaseClient
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      throw new Error('Business not found');
    }

    // 3. Check if business already has a provider (prevent multiple providers)
    const { data: existingProviders, error: providerCheckError } = await adminSupabaseClient
      .from('users')
      .select('id, firstName, lastName, role')
      .eq('businessId', businessId)
      .in('role', ['provider', 'admin/provider'])
      .limit(1);

    if (providerCheckError) {
      throw new Error('Failed to check existing providers');
    }

    if (existingProviders && existingProviders.length > 0) {
      const existingProvider = existingProviders[0];
      throw new Error(`Business "${business.name}" already has a provider: ${existingProvider.firstName} ${existingProvider.lastName} (${existingProvider.role}). Only one provider per business is allowed.`);
    }

    // 4. Update the user's profile with the new businessId and set their role
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