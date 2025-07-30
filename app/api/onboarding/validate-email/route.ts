import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if email already exists in auth system
    const adminSupa = getEnvironmentServiceRoleClient();
    
    // Query the auth.users table directly for the email
    const { data: existingUsers, error } = await adminSupa
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);
    
    if (error) {
      console.error('[Email Validation] Error checking email:', error);
      return NextResponse.json(
        { error: 'Error validating email' },
        { status: 500 }
      );
    }

    const isAvailable = !existingUsers || existingUsers.length === 0;

    return NextResponse.json({
      available: isAvailable,
      message: isAvailable 
        ? 'Email is available' 
        : 'A user with this email address has already been registered'
    });

  } catch (error) {
    console.error('[Email Validation] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 