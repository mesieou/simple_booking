import { type ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { AudioTranscriptionResult, AudioFile, ChatContext } from '@/lib/bot-engine/types';
import { transcribeAudio, TranscriptionOptions } from '@/lib/shared/llm/openai/whisper-service';

const LOG_PREFIX = '[AudioTranscriptionHandler]';

/**
 * Detects if a message contains an audio placeholder
 */
export function hasAudioContent(message: string): boolean {
  return message.includes('[AUDIO]');
}

/**
 * Extracts audio file information from message attachments
 */
function extractAudioFile(attachments?: ParsedMessage['attachments']): AudioFile | null {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const audioAttachment = attachments.find(att => att.type === 'audio');
  if (!audioAttachment || !audioAttachment.payload) {
    return null;
  }

  // Extract URL - could be stored in different properties
  const audioUrl = audioAttachment.payload.storedUrl || 
                   audioAttachment.payload.url || 
                   audioAttachment.payload.link;

  if (!audioUrl) {
    console.warn(`${LOG_PREFIX} Audio attachment found but no URL available`);
    return null;
  }

  // Extract metadata if available
  const metadata = {
    duration: audioAttachment.payload.duration,
    format: audioAttachment.payload.mime_type || audioAttachment.payload.format,
    size: audioAttachment.payload.file_size
  };

  return {
    url: audioUrl,
    metadata
  };
}

/**
 * Generates error messages in the correct language
 */
function getErrorMessage(error: string, language: 'es' | 'en'): string {
  const errorMessages = {
    duration_exceeded: {
      es: "El audio es demasiado largo (máximo 3 minutos). Por favor, envía un audio más corto o contacta con nuestro equipo.",
      en: "The audio is too long (maximum 3 minutes). Please send a shorter audio or contact our team."
    },
    file_too_large: {
      es: "El archivo de audio es demasiado grande. Por favor, envía un audio más pequeño o contacta con nuestro equipo.",
      en: "The audio file is too large. Please send a smaller audio or contact our team."
    },
    unsupported_format: {
      es: "Formato de audio no compatible. Por favor, envía el audio en un formato diferente o contacta con nuestro equipo.",
      en: "Unsupported audio format. Please send the audio in a different format or contact our team."
    },
    transcription_failed: {
      es: "No pude procesar tu audio. Por favor, intenta enviar el mensaje de nuevo o contacta con nuestro equipo para asistencia.",
      en: "I couldn't process your audio. Please try sending the message again or contact our team for assistance."
    },
    no_audio_found: {
      es: "No pude encontrar el archivo de audio. Por favor, intenta enviar el audio de nuevo.",
      en: "I couldn't find the audio file. Please try sending the audio again."
    },
    empty_transcription: {
      es: "El audio parece estar vacío o no contiene palabras reconocibles. Por favor, intenta enviar el mensaje de nuevo.",
      en: "The audio appears to be empty or doesn't contain recognizable words. Please try sending the message again."
    }
  };

  // Map error types to our predefined messages
  if (error.includes('exceeds maximum limit')) {
    return errorMessages.duration_exceeded[language];
  }
  if (error.includes('too large')) {
    return errorMessages.file_too_large[language];
  }
  if (error.includes('not supported')) {
    return errorMessages.unsupported_format[language];
  }
  if (error.includes('empty text')) {
    return errorMessages.empty_transcription[language];
  }
  if (error.includes('Audio URL is missing')) {
    return errorMessages.no_audio_found[language];
  }

  // Default error message
  return errorMessages.transcription_failed[language];
}

/**
 * Main function to handle audio transcription
 * Returns the original message if no audio, or transcribed text if audio was processed
 */
export async function handleAudioTranscription(
  message: string,
  attachments?: ParsedMessage['attachments'],
  chatContext?: ChatContext
): Promise<AudioTranscriptionResult> {
  
  // Quick check: if no audio placeholder, return original message
  if (!hasAudioContent(message)) {
    return {
      wasProcessed: false,
      transcribedMessage: message,
      originalMessage: message
    };
  }

  console.log(`${LOG_PREFIX} Audio detected in message: "${message}"`);

  try {
    // Extract audio file from attachments
    const audioFile = extractAudioFile(attachments);
    if (!audioFile) {
      console.error(`${LOG_PREFIX} Audio placeholder found but no audio file in attachments`);
      
      const language = chatContext?.participantPreferences?.language === 'es' ? 'es' : 'en';
      const errorMessage = getErrorMessage('Audio URL is missing', language);
      
      return {
        wasProcessed: true,
        transcribedMessage: errorMessage,
        originalMessage: message,
        error: 'No audio file found in attachments'
      };
    }

    console.log(`${LOG_PREFIX} Extracted audio file: ${audioFile.url}`);

    // Determine language for Whisper (helps with accuracy)
    const language = chatContext?.participantPreferences?.language === 'es' ? 'es' : 'en';
    
    // Create transcription options
    const transcriptionOptions: TranscriptionOptions = {
      language: language,
      // Add a context prompt to help with booking-related terminology
      prompt: language === 'es' 
        ? "Reserva, cita, servicio, fecha, hora, dirección, teléfono, nombre, precio, disponibilidad"
        : "Booking, appointment, service, date, time, address, phone, name, price, availability"
    };

    // Transcribe audio
    const transcriptionResult = await transcribeAudio(audioFile, transcriptionOptions);

    if (!transcriptionResult.success) {
      console.error(`${LOG_PREFIX} Transcription failed: ${transcriptionResult.error}`);
      
      const errorMessage = getErrorMessage(transcriptionResult.error || 'Unknown error', language);
      
      return {
        wasProcessed: true,
        transcribedMessage: errorMessage,
        originalMessage: message,
        error: transcriptionResult.error
      };
    }

    // Success! Replace [AUDIO] placeholder with transcribed text
    const transcribedText = transcriptionResult.text!;
    const transcribedMessage = message.replace('[AUDIO]', transcribedText);

    console.log(`${LOG_PREFIX} Audio successfully transcribed and processed: "${transcribedText}"`);

    return {
      wasProcessed: true,
      transcribedMessage: transcribedMessage,
      originalMessage: message
    };

  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error during audio transcription:`, error);
    
    const language = chatContext?.participantPreferences?.language === 'es' ? 'es' : 'en';
    const errorMessage = getErrorMessage('Transcription failed', language);
    
    return {
      wasProcessed: true,
      transcribedMessage: errorMessage,
      originalMessage: message,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 