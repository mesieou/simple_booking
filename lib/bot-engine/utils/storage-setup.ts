import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';

const LOG_PREFIX = '[Storage Setup]';

/**
 * Ensures the chat-attachments bucket exists in Supabase Storage
 */
export async function ensureChatAttachmentsBucket(): Promise<boolean> {
  try {
    const supabase = getEnvironmentServiceRoleClient();

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`${LOG_PREFIX} Error listing buckets:`, listError);
      return false;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === 'chat-attachments');
    
    if (bucketExists) {
      console.log(`${LOG_PREFIX} chat-attachments bucket already exists`);
      return true;
    }

    // Create bucket if it doesn't exist
    console.log(`${LOG_PREFIX} Creating chat-attachments bucket...`);
    
    const { error: createError } = await supabase.storage.createBucket('chat-attachments', {
      public: true, // Make it public so we can display images directly
      fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      allowedMimeTypes: [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    });

    if (createError) {
      console.error(`${LOG_PREFIX} Error creating bucket:`, createError);
      return false;
    }

    console.log(`${LOG_PREFIX} Successfully created chat-attachments bucket`);
    return true;

  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error ensuring bucket:`, error);
    return false;
  }
} 