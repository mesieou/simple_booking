import { getServiceRoleClient } from '@/lib/database/supabase/service-role';
import { getWhatsappHeaders } from '../channels/whatsapp/whatsapp-headers';
import { ensureChatAttachmentsBucket } from './storage-setup';

const LOG_PREFIX = '[MediaStorage]';

export interface StoredMediaFile {
  url: string;
  originalFilename?: string;
  mimeType?: string;
  size?: number;
}

/**
 * Downloads media from WhatsApp API and stores it in Supabase Storage
 */
export async function downloadAndStoreWhatsappMedia(
  mediaId: string,
  mediaType: 'image' | 'video' | 'document' | 'audio' | 'sticker',
  businessId: string,
  sessionId: string
): Promise<StoredMediaFile | null> {
  try {
    console.log(`${LOG_PREFIX} Starting download for media ID: ${mediaId}`);

    // Ensure storage bucket exists
    const bucketReady = await ensureChatAttachmentsBucket();
    if (!bucketReady) {
      console.error(`${LOG_PREFIX} Storage bucket not ready`);
      return null;
    }

    // Step 1: Get media URL from WhatsApp API
    const mediaUrl = await getWhatsappMediaUrl(mediaId);
    if (!mediaUrl) {
      console.error(`${LOG_PREFIX} Failed to get media URL for ${mediaId}`);
      return null;
    }

    // Step 2: Download the actual media file
    const mediaFile = await downloadMediaFromUrl(mediaUrl);
    if (!mediaFile) {
      console.error(`${LOG_PREFIX} Failed to download media from URL`);
      return null;
    }

    // Step 3: Upload to Supabase Storage
    const storedFile = await uploadToSupabaseStorage(
      mediaFile,
      mediaType,
      businessId,
      sessionId,
      mediaId
    );

    console.log(`${LOG_PREFIX} Successfully stored media: ${storedFile?.url}`);
    return storedFile;

  } catch (error) {
    console.error(`${LOG_PREFIX} Error in downloadAndStoreWhatsappMedia:`, error);
    return null;
  }
}

/**
 * Step 1: Get media URL from WhatsApp API
 */
async function getWhatsappMediaUrl(mediaId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: getWhatsappHeaders()
    });

    if (!response.ok) {
      console.error(`${LOG_PREFIX} WhatsApp API error getting media URL:`, response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.url || null;

  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting WhatsApp media URL:`, error);
    return null;
  }
}

/**
 * Step 2: Download media from WhatsApp URL
 */
async function downloadMediaFromUrl(url: string): Promise<{
  buffer: ArrayBuffer;
  contentType: string;
  contentLength?: number;
} | null> {
  try {
    const response = await fetch(url, {
      headers: getWhatsappHeaders(),
      // WhatsApp media URLs expire, so download immediately
      cache: 'no-cache'
    });

    if (!response.ok) {
      console.error(`${LOG_PREFIX} Failed to download media:`, response.status, response.statusText);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = parseInt(response.headers.get('content-length') || '0');

    return { buffer, contentType, contentLength };

  } catch (error) {
    console.error(`${LOG_PREFIX} Error downloading media:`, error);
    return null;
  }
}

/**
 * Step 3: Upload to Supabase Storage
 */
async function uploadToSupabaseStorage(
  mediaFile: { buffer: ArrayBuffer; contentType: string; contentLength?: number },
  mediaType: string,
  businessId: string,
  sessionId: string,
  mediaId: string
): Promise<StoredMediaFile | null> {
  try {
    const supabase = getServiceRoleClient();

    // Create filename with timestamp to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = getFileExtension(mediaFile.contentType);
    const filename = `${mediaType}_${timestamp}_${mediaId}${extension}`;
    
    // Organize by business/session for better structure
    const filePath = `chat-media/${businessId}/${sessionId}/${filename}`;

    console.log(`${LOG_PREFIX} Uploading to path: ${filePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, mediaFile.buffer, {
        contentType: mediaFile.contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: false
      });

    if (error) {
      console.error(`${LOG_PREFIX} Supabase Storage upload error:`, error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(data.path);

    return {
      url: publicUrlData.publicUrl,
      originalFilename: filename,
      mimeType: mediaFile.contentType,
      size: mediaFile.contentLength
    };

  } catch (error) {
    console.error(`${LOG_PREFIX} Error uploading to Supabase Storage:`, error);
    return null;
  }
}

/**
 * Helper function to get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  };

  return extensions[mimeType] || '';
} 