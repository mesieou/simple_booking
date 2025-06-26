import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/supabase/server";
import { User } from "@/lib/database/models/user";
import { Notification } from "@/lib/database/models/notification";
import { ChatSession } from "@/lib/database/models/chat-session";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const phoneNumber = searchParams.get('phoneNumber');

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        console.log(`[UserDetails] Fetching details for phone number: ${phoneNumber}`);

        // Priority-based name extraction logic (same as escalation handlers)
        let customerName = null;
        let whatsappName = null;
        
        // TODO: In the future, we could extract WhatsApp profile names from recent message history
        // For now, we'll focus on database-based name extraction

        // 1. First try to get user from database by phone number
        const user = await User.findUserByCustomerWhatsappNumber(phoneNumber);
        
        if (user && user.firstName && user.lastName) {
            customerName = `${user.firstName} ${user.lastName}`;
            console.log(`[UserDetails] Using database user name: ${customerName}`);
        } else {
            // 2. Try to find linked user through chat sessions
            try {
                const supabase = createClient();
                
                // Query for WhatsApp chat sessions with this phone number
                const { data: chatSessions, error } = await supabase
                    .from('chatSessions')
                    .select('id, userId, createdAt')
                    .eq('channel', 'whatsapp')
                    .eq('channelUserId', phoneNumber)
                    .not('userId', 'is', null) // We want sessions that DO have a linked user
                    .order('createdAt', { ascending: false })
                    .limit(10);

                if (!error && chatSessions && chatSessions.length > 0) {
                    // Try to get the most recent session with a linked user
                    for (const session of chatSessions) {
                        if (session.userId) {
                            const linkedUser = await User.getById(session.userId);
                            if (linkedUser && linkedUser.firstName && linkedUser.lastName) {
                                customerName = `${linkedUser.firstName} ${linkedUser.lastName}`;
                                console.log(`[UserDetails] Using linked user name from chat session: ${customerName}`);
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`[UserDetails] Error fetching chat sessions or linked user:`, error);
            }
        }

        // If still no name found, use phone number
        if (!customerName) {
            customerName = phoneNumber;
            console.log(`[UserDetails] Using phone number as fallback: ${customerName}`);
        }

        // Get escalation count for this phone number
        const escalationCount = await Notification.getEscalationCountByPhoneNumber(phoneNumber);
        
        // Get last escalation date
        const lastEscalation = await Notification.getLastEscalationByPhoneNumber(phoneNumber);

        const userDetails = {
            phoneNumber: phoneNumber,
            name: customerName,
            whatsappName: whatsappName, // Will be null for now, but we can enhance this later
            escalationCount: escalationCount || 0,
            lastEscalationDate: lastEscalation?.createdAt || null
        };

        console.log(`[UserDetails] Found details:`, userDetails);

        return NextResponse.json(userDetails);

    } catch (error) {
        console.error('[UserDetails] Error fetching user details:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch user details' 
        }, { status: 500 });
    }
} 