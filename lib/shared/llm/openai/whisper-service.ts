import OpenAI from 'openai';
import { AudioFile, AudioMetadata } from '@/lib/bot-engine/types';

const LOG_PREFIX = '[WhisperService]';

// Maximum audio duration in seconds (3 minutes)
const MAX_AUDIO_DURATION = 180;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptionOptions {
  language?: 'es' | 'en';
  prompt?: string;
}

/**
 * Validates audio file before transcription
 */
export function validateAudioFile(audioFile: AudioFile): { isValid: boolean; error?: string } {
  if (!audioFile.url) {
    return { isValid: false, error: 'Audio URL is missing' };
  }

  // Check duration if available
  if (audioFile.metadata?.duration && audioFile.metadata.duration > MAX_AUDIO_DURATION) {
    return { 
      isValid: false, 
      error: `Audio duration (${Math.round(audioFile.metadata.duration)}s) exceeds maximum limit of ${MAX_AUDIO_DURATION}s (3 minutes)` 
    };
  }

  return { isValid: true };
}

/**
 * Downloads audio file and transcribes using OpenAI Whisper
 */
export async function transcribeAudio(
  audioFile: AudioFile, 
  options: TranscriptionOptions = {}
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    console.log(`${LOG_PREFIX} Starting transcription for audio: ${audioFile.url}`);

    // Validate audio file
    const validation = validateAudioFile(audioFile);
    if (!validation.isValid) {
      console.error(`${LOG_PREFIX} Audio validation failed: ${validation.error}`);
      return { success: false, error: validation.error };
    }

    // Download audio file
    const audioResponse = await fetch(audioFile.url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
    }

    // Get audio as buffer
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer]);
    
    // Create a File object for Whisper API
    const audioFileName = `audio_${Date.now()}.ogg`; // WhatsApp usually sends .ogg files
    const audioFileForWhisper = new File([audioBlob], audioFileName, { type: 'audio/ogg' });

    console.log(`${LOG_PREFIX} Downloaded audio file, size: ${audioBlob.size} bytes`);

    // Prepare transcription parameters
    const transcriptionParams: OpenAI.Audio.Transcriptions.TranscriptionCreateParams = {
      file: audioFileForWhisper,
      model: 'whisper-1',
      response_format: 'text',
    };

    // Set language if specified (helps with accuracy and cost)
    if (options.language) {
      transcriptionParams.language = options.language;
      console.log(`${LOG_PREFIX} Using language hint: ${options.language}`);
    }

    // Add context prompt if provided (helps with domain-specific terms)
    if (options.prompt) {
      transcriptionParams.prompt = options.prompt;
    }

    // Call Whisper API
    console.log(`${LOG_PREFIX} Calling OpenAI Whisper API...`);
    const transcription = await openai.audio.transcriptions.create(transcriptionParams);

    // Extract text from transcription response
    const transcribedText = (typeof transcription === 'string' ? transcription : transcription.text || '').trim();
    console.log(`${LOG_PREFIX} Transcription successful: "${transcribedText}"`);

    if (!transcribedText) {
      return { success: false, error: 'Transcription returned empty text' };
    }

    return { success: true, text: transcribedText };

  } catch (error) {
    console.error(`${LOG_PREFIX} Transcription failed:`, error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('file_size_exceeded')) {
        return { success: false, error: 'Audio file is too large for transcription' };
      }
      if (error.message.includes('unsupported_file_type')) {
        return { success: false, error: 'Audio file format is not supported' };
      }
      return { success: false, error: `Transcription failed: ${error.message}` };
    }

    return { success: false, error: 'Unknown transcription error occurred' };
  }
} 