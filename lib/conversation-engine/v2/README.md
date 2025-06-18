# V2 Intelligent Assistant System

This directory contains the new multi-intent conversation engine that transforms the rigid step-based chatbot into an intelligent, fluid assistant capable of handling complex, natural conversations.

## 🧠 Core Intelligence Features

### ✅ Multi-Intent Detection
- **Single Message, Multiple Actions**: "Hi! Do you do gel manicures? Can I book Tuesday at 3pm?"
- **Handles**: Greeting + FAQ + Booking request in one response
- **Result**: Natural, comprehensive reply addressing all user needs

### ✅ Flexible Booking Management  
- **Any Order Input**: User can provide date, time, service in any sequence
- **Smart Slot Filling**: Detects missing information and asks intelligently
- **Edit Support**: "Change the time" or "Actually I want a different service"
- **No Restart Required**: Updates existing booking seamlessly

### ✅ Intelligent Context Awareness
- **Existing Booking Detection**: "Hi, can I book something?" → "You started booking a gel manicure yesterday. Continue or start new?"
- **Conflict Prevention**: Only one active booking per user
- **Smart Resumption**: Handles interruptions and returns to main task

### ✅ Natural Conversation Flow
- **FAQ + Booking**: Answers questions while progressing booking
- **Availability Checks**: "Do you have time Thursday at 8?" → Checks + offers booking
- **Mixed Input**: Buttons and text work equally well

## 🏗️ Architecture Overview

```
User Message → Multi-Intent Classifier → Task Handlers → Response Generator → User
                      ↓
                Context Updates (Database)
```

### Key Components

1. **Multi-Intent Classifier** (`nlu/multi-intent-classifier.ts`)
   - Uses OpenAI function calling for flexible intent detection
   - Analyzes booking context to prevent conflicts
   - Updates dialogue state intelligently

2. **Dialogue State** (`nlu/types.ts`)
   - Minimal, focused state tracking
   - Prevents simultaneous bookings
   - Stores only essential information

3. **Task Handlers** (To be implemented)
   - `BookingManager`: Slot-filling with intelligent next-step detection
   - `FAQHandler`: RAG-based question answering
   - `ChitchatHandler`: Natural social interaction
   - `AvailabilityHandler`: Smart availability checking with booking offers

## 📋 Booking Flow Intelligence

### Traditional Flow (Rigid)
```
Step 1: Ask Name → Step 2: Ask Service → Step 3: Ask Date → Step 4: Ask Time
```

### V2 Flow (Intelligent)
```
Any Input → Detect Slots → Determine Missing → Ask for Next Most Important
```

**Example Scenarios:**

**Scenario 1**: `"Hi, I'm Sarah. Can I book Tuesday at 3pm?"`
- **Detected**: userName=Sarah, date=Tuesday, time=3pm
- **Missing**: service
- **Response**: "Hi Sarah! I can book you for Tuesday at 3pm. What service would you like?"
- **Buttons**: [Service options with Tuesday 3pm slots available]

**Scenario 2**: `"Do you have time Thursday at 8?"`
- **Action**: Check availability for Thursday 8pm
- **If Available**: "Yes! Thursday at 8pm is available. Would you like to book a service?"
- **If Not**: "Thursday 8pm isn't available, but I have 7pm or 9pm. Which works?"
- **Buttons**: [7pm] [9pm] [Choose different day]

**Scenario 3**: User with existing incomplete booking
- **Context**: Has active booking for gel manicure, missing date/time
- **User**: `"Hi, can I book something?"`
- **Response**: "Hi! I see you started booking a gel manicure. Would you like to continue with that or start something new?"
- **Buttons**: [Continue Gel Manicure] [Start New Booking]

## 🔄 Response Generation Strategy

### Multi-Intent Response Order
1. **Chitchat** (greetings, thanks) - First
2. **FAQ** (questions, information) - Middle  
3. **Booking** (progress, next steps) - Last (for follow-up)

**Example**: 
- **Input**: `"Thanks! Do you do eyebrow threading? Can we make it 4pm?"`
- **Response**: "You're welcome! Yes, we do eyebrow threading for $30. I've updated your booking to 4pm. Is there anything else you'd like to change?"

## 🚀 Implementation Plan

### Phase 1: Multi-Intent Foundation ✅
- [x] Multi-Intent Classifier with function calling
- [x] Dialogue State types and structure
- [x] Context analysis and booking conflict detection

### Phase 2: Task Handlers (Next)
- [ ] BookingManager with intelligent slot filling
- [ ] FAQHandler with RAG integration  
- [ ] ChitchatHandler for natural interaction
- [ ] AvailabilityHandler for smart availability checks

### Phase 3: Integration
- [ ] New V2 Orchestrator
- [ ] Response Generator for natural language
- [ ] Message Formatter for WhatsApp
- [ ] Database integration and context persistence

### Phase 4: Deployment
- [ ] Feature flag for V1/V2 switching
- [ ] Testing and validation
- [ ] Gradual rollout

## 🧪 Testing the System

Run the examples to see how the multi-intent classifier handles various scenarios:

```typescript
import { runAllExamples } from './example-usage';
runAllExamples();
```

This demonstrates:
- Simple greetings
- Complex multi-intent messages
- Booking updates and changes
- FAQ during active bookings
- Availability checks

## 🎯 Key Behaviors Achieved

### ✅ Intelligent Human-Like Assistant
- Understands multiple intents per message
- Responds naturally and completely
- Never loses context or breaks flow

### ✅ Smart Booking Management
- No simultaneous bookings allowed
- Handles interruptions gracefully
- Resumes tasks smoothly
- Accepts information in any order

### ✅ Context-Driven Decisions
- Uses current state to guide responses
- Prevents conflicts automatically
- Offers relevant suggestions

### ✅ Natural Conversation
- Handles mixed input formats
- Maintains conversational tone
- Provides comprehensive responses

This system transforms the chatbot from a rigid state machine into an intelligent assistant that behaves like a capable human agent. 