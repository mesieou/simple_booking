require('dotenv').config();

async function cleanupOrphanedSessions() {
  try {
    console.log('🧹 Starting cleanup of orphaned chat sessions...\n');
    
    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    
    // Create client with service role key (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables:');
      console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
      console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
      return;
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Connected to Supabase\n');
    
    // Find all chat sessions that reference non-existent businesses
    console.log('🔍 Finding orphaned chat sessions...');
    const { data: orphanedSessions, error: findError } = await supabase
      .from('chatSessions')
      .select(`
        id, 
        businessId, 
        channelUserId, 
        createdAt,
        businesses!left(id)
      `)
      .is('businesses.id', null);
    
    if (findError) {
      console.error('❌ Error finding orphaned sessions:', findError);
      return;
    }
    
    if (!orphanedSessions || orphanedSessions.length === 0) {
      console.log('✅ No orphaned sessions found. Database is clean!');
      return;
    }
    
    console.log(`🚨 Found ${orphanedSessions.length} orphaned chat session(s):\n`);
    
    // Display details
    orphanedSessions.forEach((session, index) => {
      console.log(`${index + 1}. Session ID: ${session.id}`);
      console.log(`   Business ID: ${session.businessId} (DOES NOT EXIST)`);
      console.log(`   Channel User: ${session.channelUserId}`);
      console.log(`   Created: ${session.createdAt}\n`);
    });
    
    // Get session IDs for notification cleanup
    const sessionIds = orphanedSessions.map(s => s.id);
    const businessIds = [...new Set(orphanedSessions.map(s => s.businessId))];
    
    console.log('📋 Summary:');
    console.log(`   Sessions to delete: ${sessionIds.length}`);
    console.log(`   Orphaned Business IDs: ${businessIds.length}`);
    console.log(`   Business IDs: ${businessIds.join(', ')}\n`);
    
    // Delete notifications first (they reference chat sessions)
    console.log('🗑️  Deleting related notifications...');
    const { error: notificationError, count: deletedNotifications } = await supabase
      .from('notifications')
      .delete()
      .in('chatSessionId', sessionIds);
    
    if (notificationError) {
      console.warn('⚠️  Warning: Error deleting notifications:', notificationError.message);
      // Continue anyway, notifications might not exist
    } else {
      console.log(`✅ Deleted ${deletedNotifications || 0} related notifications`);
    }
    
    // Delete the orphaned chat sessions
    console.log('🗑️  Deleting orphaned chat sessions...');
    const { error: deleteError, count: deletedSessions } = await supabase
      .from('chatSessions')
      .delete()
      .in('id', sessionIds);
    
    if (deleteError) {
      console.error('❌ Error deleting sessions:', deleteError);
      return;
    }
    
    console.log(`✅ Successfully deleted ${deletedSessions || 0} orphaned chat sessions\n`);
    
    console.log('🎉 Cleanup completed successfully!');
    console.log('✅ Your chat system should now work properly.');
    console.log('✅ Try sending messages again - they should work now.\n');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

cleanupOrphanedSessions(); 