# Audio Transcription Module

Este módulo se encarga de transcribir mensajes de audio de WhatsApp usando OpenAI Whisper.

## 🎯 Funcionalidad

- **Detección automática**: Identifica mensajes con placeholder `[AUDIO]`
- **Transcripción inteligente**: Usa OpenAI Whisper con hints de idioma (ES/EN)
- **Validación**: Verifica duración máxima (3 minutos) y formato
- **Manejo de errores**: Mensajes de error contextuales en ES/EN
- **Preservación**: Guarda audio original + transcripción en historial

## 🔄 Flujo de procesamiento

```
Audio WhatsApp → Parser ([AUDIO] placeholder) → Escalation (NO escala) → 
Audio Transcription → Bot Engine (recibe texto transcrito)
```

## 📁 Estructura

```
lib/bot-engine/audio-transcription/
├── index.ts                           # Exportaciones
├── audio-transcription-handler.ts     # Lógica principal
└── README.md                         # Esta documentación

lib/bot-engine/types/
└── index.ts                          # Tipos centrales (incluye AudioTranscriptionResult, AudioFile, AudioMetadata)

lib/shared/llm/openai/
└── whisper-service.ts                # Servicio OpenAI Whisper (centralizado)
```

## 🛠️ Uso

```typescript
// Importar desde el módulo
import { handleAudioTranscription } from '@/lib/bot-engine/audio-transcription';

// O importar directamente los tipos y servicios
import { AudioTranscriptionResult, AudioFile } from '@/lib/bot-engine/types';
import { transcribeAudio } from '@/lib/shared/llm/openai/whisper-service';

const result = await handleAudioTranscription(
  message,           // "[AUDIO]" o mensaje normal
  attachments,       // Attachments con audio file
  chatContext        // Para determinar idioma
);

if (result.wasProcessed) {
  // Audio fue procesado
  const transcribedText = result.transcribedMessage;
  
  if (result.error) {
    // Error en transcripción, enviar mensaje de error
  } else {
    // Éxito, usar texto transcrito
  }
}
```

## ⚙️ Configuración

### Variables de entorno requeridas:
```env
OPENAI_API_KEY=your_openai_api_key
```

### Límites configurados:
- **Duración máxima**: 3 minutos (180 segundos)
- **Idiomas soportados**: Español (es) e Inglés (en)
- **Formatos**: Todos los soportados por Whisper (WhatsApp usa .ogg)

## 💰 Costos

- **OpenAI Whisper**: $0.006 por minuto
- **Ejemplo**: Audio de 3 min = ~$0.018
- **Estimado**: 100 audios/día = ~$2/día = ~$60/mes

## 🚨 Manejo de errores

El módulo maneja automáticamente:

1. **Audio muy largo** (>3 min): Error con sugerencia de acortar
2. **Archivo muy grande**: Error con sugerencia de archivo menor
3. **Formato no compatible**: Error con sugerencia de formato diferente
4. **Transcripción vacía**: Error sugiriendo reenviar
5. **Audio no encontrado**: Error sugiriendo reenviar
6. **Errores de red/API**: Error genérico sugiriendo contactar equipo

Todos los errores se envían en el idioma correcto (ES/EN) según el contexto del usuario.

## 🔍 Logging

El módulo registra eventos importantes:
- Detección de audio
- Inicio/fin de transcripción
- Errores y su tipo
- Resultados exitosos

Usa el prefijo `[AudioTranscriptionHandler]` y `[WhisperService]` para facilitar debugging.

## 🧪 Testing

Para probar el módulo:

1. **Enviar audio corto** (<3 min) → Debe transcribir correctamente
2. **Enviar audio largo** (>3 min) → Debe mostrar error de duración
3. **Enviar mensaje sin audio** → Debe pasar transparentemente
4. **Probar en ES/EN** → Errores deben estar en idioma correcto

## 🔧 Mantenimiento

- **Logs**: Revisar logs de transcripción para detectar problemas
- **Costos**: Monitorear uso de Whisper API
- **Límites**: Ajustar `MAX_AUDIO_DURATION` si es necesario
- **Idiomas**: Agregar más idiomas en `TranscriptionOptions` si se requiere 