# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skedy is an AI-powered WhatsApp booking agent for service businesses. It provides 24/7 automated customer service, dynamic quoting (Uber-like pricing), and calendar management through WhatsApp conversations and a web interface.

## Key Commands

### Development
```bash
npm run dev              # Start development server
npm run dev:mock         # Start with mocked GPT responses
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint
```

### Testing
```bash
npm run test                    # Run all tests
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests
npm run test:escalation        # Escalation flow tests
npm run test:notifications     # Notification tests

# Run specific test files
npm run test path/to/test.ts
```

### Database Management
```bash
npm run db:pull-dev      # Pull dev database schema
npm run db:push-dev      # Push schema changes to dev
npm run seed             # Seed database with test data
```

### Setup & Utilities
```bash
npm run setup:check      # Verify local setup
npm run setup:quick      # Quick setup with env template
```

## Architecture Overview

### Bot Engine Architecture

The WhatsApp bot uses a sophisticated flow-based conversation system located in `lib/bot-engine/`:

#### Core Components
1. **MessageProcessor** (`core/message-processor.ts`): Entry point handling message routing, goal detection, payment completion, and language detection
2. **FlowController** (`core/flow-controller.ts`): Smart navigation with step skipping, go-back functionality, and business-specific routing
3. **GoalManager** (`core/goal-manager.ts`): Creates and manages user goals, handles topic switching

#### Services Layer
- **ScalableNotificationService** (`services/`): Multi-channel notifications (WhatsApp, SMS, Email) with automatic fallback
- **LLMService**: AI-powered intent detection and contextual responses
- **LanguageService**: Auto-detection and multi-language support (English/Spanish)
- **UserService**: Customer data management

#### Channel Implementation (`channels/whatsapp/`)
- **MessageSender**: Handles text, buttons, lists, templates, media
- **PayloadParser**: Processes WhatsApp webhooks
- **ResponseProcessor**: Formats responses for WhatsApp
- **Deduplication**: Prevents duplicate processing
- **ProxyMessageInterceptor**: Enables admin-customer communication

#### Escalation System (`escalation/`)
- **EscalationOrchestrator**: Detects when human help is needed
- **ProxyCommunication**: Admins can respond as the bot
- AI-powered trigger detection for complex queries

#### Session Management (`session/`)
- **SessionManager**: Multi-channel support with business timezone handling
- **StatePersister**: Database persistence and recovery

#### Step Handlers (`steps/`)
- **Booking Steps**: Service selection, address collection, time selection, quote generation, payment
- **Account Steps**: User/business authentication
- **FAQ Handler**: AI-powered FAQ responses

#### Configuration (`config/`)
- **Blueprints**: Business-specific flows (removalist, salon, mobile/non-mobile services)
- **Tasks**: Maps steps to handlers
- **Translations**: Multi-language message templates

#### Additional Features
- **Audio Transcription**: Voice message processing with OpenAI Whisper
- **Media Storage**: File upload handling
- **Comprehensive Logging**: Journey tracking and performance monitoring

#### Architectural Patterns
- Component-based with clear separation of concerns
- Provider pattern for notifications
- Strategy pattern for business-specific flows
- Chain of responsibility for message processing
- Automatic session recovery and state persistence

### Database Models

Complete list of Supabase models in `lib/database/models/`:
- **User**: Customer accounts and authentication
- **Business**: Service provider accounts with settings
- **Booking**: Booking records with status tracking
- **Service**: Business services, pricing, and duration
- **Price**: Dynamic pricing rules and adjustments
- **Quote**: Price quotes generated for customers
- **ChatSession**: WhatsApp conversation state persistence
- **UserContext**: User conversation context and goals
- **Interaction**: Message history and interactions
- **AvailabilitySlots**: Business availability and time slots
- **CalendarSettings**: Business calendar configuration
- **Events**: Calendar events and bookings
- **Notification**: System notifications and alerts
- **NotificationProxyExtensions**: Notification delivery extensions
- **Documents**: Uploaded documents and files
- **Embeddings**: Vector embeddings for semantic search
- **CrawlSession**: Website crawling session data

### API Structure

Next.js API routes in `app/api/`:
- `/webhook`: WhatsApp webhook endpoint
- `/bookings`: Booking management
- `/auth`: Authentication endpoints
- `/cron`: Scheduled tasks (availability rolling)

### Frontend Architecture

- **Components**: Reusable React components using shadcn/ui
- **Providers**: Context providers for auth and business data
- **Forms**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with custom theme

## Coding Guidelines

### TypeScript & React Best Practices
- Use early returns for readability
- Prefer `const` over `function` declarations
- Use descriptive names with `handle` prefix for event handlers
- Implement proper TypeScript types, avoid `any`
- Use Tailwind classes exclusively for styling

### Bot Engine Development
- Each step handler must implement `validateUserInput()` and `processAndExtractData()`
- Auto-advance steps should set `autoAdvance: true`
- Always persist state changes immediately
- Use structured logging with journey tracking
- Handle errors gracefully with fallback paths

### Database Operations
- Use Row Level Security (RLS) policies
- Always include proper error handling
- Use transactions for multi-table operations
- Follow existing query patterns in `lib/database/queries/`

### WhatsApp Integration
- Verify webhook signatures for security
- Handle message status updates properly
- Use interactive buttons when appropriate
- Keep messages concise and mobile-friendly

## Key Technologies

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI/LLM**: OpenAI GPT-4
- **Messaging**: WhatsApp Business API
- **Payments**: Stripe
- **UI**: shadcn/ui + Tailwind CSS
- **Testing**: Jest + Testing Library
- **Real-time**: Supabase Realtime subscriptions

## Environment Variables

Complete list of environment variables used in the project:

### Supabase Database
- `SUPABASE_DEV_URL`
- `SUPABASE_DEV_ANON_KEY`
- `SUPABASE_DEV_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `DB_PASSWORD`
- `SUPABASE_PROD_URL`
- `SUPABASE_PROD_ANON_KEY`
- `SUPABASE_PROD_SERVICE_ROLE_KEY`
- `SUPABASE_PROD_DATABASE_URL`
- `SUPABASE_PROD_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### WhatsApp Business API
- `WHATSAPP_PERMANENT_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `USE_WABA_WEBHOOK`

### AI/LLM Services
- `OPENAI_API_KEY`

### Payment Processing
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### External Services
- `GOOGLE_MAPS_API_KEY`

### Application Configuration
- `NODE_ENV`
- `NEXT_PUBLIC_SITE_URL`
- `USE_CLEAN_ARCHITECTURE`
- `CRON_SECRET`
- `SEED_SECRET`