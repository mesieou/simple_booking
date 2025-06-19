# **🚀 Modular Human Escalation System**

## **Overview**

This directory contains the "Sidecar" Human Escalation System, a fully independent module designed to be plugged into any conversational AI engine with minimal effort. Its purpose is to detect when a user needs to speak with a human, pause the bot's standard response logic, and manage the handoff process.

The system is built on a principle of clean separation of concerns, ensuring it is portable, maintainable, and robust.

---

## **🏗️ Core Architecture: The "Sidecar" Model**

This module is designed to be completely decoupled from the main conversation engine. It does not know about the engine's internal state management (`DialogueState`) or intent classification. The engine is responsible for calling the module and managing its own state based on the module's output.

```mermaid
graph TD
    subgraph Your Chatbot System (V2, V3, etc.)
        A[Webhook Receives Message] --> B{Your Main Handler};
        B --> C{1. Ask EscalationManager if Paused};
        C -- No --> D{2. Ask EscalationDetector if Escalation Needed};
        D -- No --> E[Continue Normal Bot Logic...];
        E --> F[Send Bot Response];
    end

    subgraph Independent Escalation Module
        G(EscalationManager & Detector)
    end
    
    C -- Yes --> H[Bot is Paused, No Response Sent];
    D -- Yes --> I[3. Call initiateEscalation];
    I --> J[Send Handoff Message];
    J --> K[Update Your State in DB];
    
    B -- Reads State --> L[Your Database];
    K --> L;
    
    style G fill:#D6EAF8,stroke:#5DADE2,stroke-width:2px
```

---

## **🏗️ Architecture**

The system consists of two main components and relies on a specific database schema for state management.

### **1. `EscalationDetector` (`detector.ts`)**
- **Responsibility:** To analyze raw user text and identify an explicit request for human intervention.
- **Method:** `isEscalationRequired(userMessage: string): boolean`
- **Logic:** Uses a combination of simple keyword triggers (e.g., "talk to a human") and more flexible regular expressions to detect intent. It is completely stateless and independent of any NLP/NLU engine.

### **2. `EscalationManager` (`manager.ts`)**
- **Responsibility:** To manage the state of the escalation and perform all related actions (e.g., creating notifications, pausing the bot).
- **Key Methods:**
    - `isConversationLocked(status: EscalationStatus): boolean`: Checks if the bot should be paused.
    - `initiateEscalation(...)`: Creates a notification and returns the standardized handoff message and new state.
    - `resolveEscalation()`: Returns the state object for marking a conversation as resolved.

### **3. Database State (`DialogueState`)**
The calling system must manage a state object (`DialogueState`) that contains an `escalationStatus` field. This field is the "source of truth" that the `EscalationManager` checks.

- **`escalationStatus` values:**
    - `none` (or `null`/`undefined`): Normal bot operation.
    - `pending_human`: Escalation triggered; waiting for an admin to respond.
    - `in_progress_human`: Admin has taken control of the conversation.
    - `resolved_human`: Admin has resolved the issue; bot can resume control.

---

## **⚙️ How to Integrate with Any Chatbot System**

Integrating this module is a simple, two-step process that involves adding checks at the very beginning of your main message handler. The key principle is that **your system is responsible for persisting its own state**. The `EscalationManager` only provides instructions on *what* state changes to make.

### **Step 1: Check if the Conversation is Locked (The "Pause Switch")**

Before your bot runs any of its own logic, it must ask the `EscalationManager` if it should remain silent.

```typescript
// Example in your main message handler
import { EscalationManager } from '@/lib/escalation-system';

async function handleUserMessage(message, session) {
  
  // 1. Retrieve the CURRENT escalation status from YOUR state management system.
  //    This could be from a database, a cache, or a session object.
  const currentStatus = session.dialogueState?.escalationStatus;

  // 2. Ask the manager if the bot should be paused by passing ONLY the status string.
  if (EscalationManager.isConversationLocked(currentStatus)) {
    // If locked, do nothing. The bot is paused for this user.
    // You might still want to save the user's message for the admin to see.
    console.log("Conversation is locked. Bot is silent.");
    return; 
  }
  
  // ... proceed with the rest of your bot logic
}
```

### **Step 2: Check if the New Message Requires Escalation (The "Alarm")**

If the conversation is not already locked, you then check if the *new* message is a request for help.

```typescript
// Continuing the example
import { EscalationManager, EscalationDetector } from '@/lib/escalation-system';

async function handleUserMessage(message, session) {
  
  // ... (Step 1 code from above)
  
  // 3. Ask the detector if the new message is an escalation request.
  //    This function is pure and only takes the user's raw text.
  if (EscalationDetector.isEscalationRequired(message.text)) {
    
    // 4. If yes, call initiateEscalation with primitive data.
    //    The manager will create the notification and return the state change instructions.
    const escalationResult = await EscalationManager.initiateEscalation(
      session.businessId,
      session.id,
      session.channelUserId,
      message.text
    );
    
    // 5. YOUR SYSTEM is responsible for updating its own state.
    //    Merge the returned state object into your main dialogue state.
    const newDialogueState = {
        ...session.dialogueState,
        ...escalationResult.updatedState
    };
    await persistYourState(session.id, newDialogueState);
    
    // 6. Send the handoff message to the user and stop processing.
    sendResponseToUser(escalationResult.response);
    return;
  }
  
  // If no escalation is needed, run your normal bot pipeline
  const botResponse = await runNormalBotPipeline(message, session);
  sendResponseToUser(botResponse);
}
```

By following this pattern, your bot's core logic remains clean and decoupled. It delegates all escalation decisions to the "sidecar" module and only acts upon the simple, clear instructions it receives back.

---

## **🛠️ Admin Panel APIs**

To complete the loop, the administrator's frontend needs to call a few backend APIs.

### `POST /api/admin/take-control`
- **Purpose:** For an admin to signal they are handling the chat.
- **Action:** Sets `escalationStatus` to `in_progress_human`.

### `POST /api/admin/send-message`
- **Purpose:** For an admin to send a message to the user.
- **Action:** Sends a message via the appropriate channel (e.g., WhatsApp) and logs it to the chat history.

### `POST /api/admin/resolve-chat`
- **Purpose:** For an admin to close the escalation and return control to the bot.
- **Action:** Calls `EscalationManager.resolveEscalation()` and updates the state to `resolved_human`.

By following this architecture, you create a powerful, decoupled escalation system that enhances your chatbot's capabilities without creating technical debt. 