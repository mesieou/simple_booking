// Main handler
export { handleAudioTranscription, hasAudioContent } from './audio-transcription-handler';

// Types (re-exported from central types)
export type { AudioTranscriptionResult, AudioFile, AudioMetadata } from '@/lib/bot-engine/types';
 
// Whisper service (if needed for testing or advanced usage)
export { transcribeAudio, validateAudioFile } from '@/lib/shared/llm/openai/whisper-service';
export type { TranscriptionOptions } from '@/lib/shared/llm/openai/whisper-service'; 