import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/supabase/server';
import { Notification } from '@/lib/database/models/notification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Optional: Add role-based access control here if needed
  // For example, check if the user has an 'admin' role.

  try {
    const { notificationId, status } = await req.json();

    if (!notificationId || !status) {
      return NextResponse.json({ message: 'Missing notificationId or status' }, { status: 400 });
    }

    if (!['provided_help', 'ignored', 'wrong_activation'].includes(status)) {
        return NextResponse.json({ message: 'Invalid status provided' }, { status: 400 });
    }

    const updatedNotification = await Notification.resolve(notificationId, status);

    if (!updatedNotification) {
      return NextResponse.json({ message: 'Notification not found or failed to update' }, { status: 404 });
    }

    return NextResponse.json({ 
        message: 'Chat resolved successfully', 
        notification: updatedNotification 
    });

  } catch (error) {
    console.error('[API] Error resolving chat notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
} 