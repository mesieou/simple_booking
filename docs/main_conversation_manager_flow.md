# Main Conversation Manager Flow

This diagram specifically reflects the logic within `routeInteraction` in `lib/conversation-engine/main-conversation-manager.ts`.

```mermaid
graph TD
    A["routeInteraction_Start(parsedMessage, context)"] --> B["Update_context_chatHistory_with_user_message"];
    B --> C["Call_analyzeClientNeed_LLM(text, history)"];
    C --> D["Update_context_lastUserIntent"];
    D --> E{"context_currentMode_is_IdleMode?"};

    E -- Yes --> F{"Evaluate_context_lastUserIntent_intent"};
    F -- "request_booking" --> G["nextMode = BookingMode"];
    F -- "ask_faq" --> H["nextMode = FAQMode"];
    F -- "default" --> I["nextMode = IdleMode"];
    G --> J["Update_context_currentMode_if_changed"];
    H --> J;
    I --> J;
    
    E -- No --> J;

    J --> K{"Switch_on_context_currentMode"};
    K -- "BookingMode" --> L["Call_handleBookingModeInteraction"];
    K -- "FAQMode" --> M["Call_handleFAQModeInteraction_STUB"];
    K -- "AccountMode" --> N["Call_handleAccountModeInteraction_STUB"];
    K -- "EscalationMode" --> O["Call_handleEscalationModeInteraction_STUB"];
    K -- "IdleMode_or_Default" --> P["Call_handleIdleModeInteraction"];

    L --> Q["botResponse_from_handler"];
    M --> Q;
    N --> Q;
    O --> Q;
    P --> Q;

    Q --> R["Log_Response_and_Mode"];
    R --> S["Return_{finalBotResponse_updatedContext}"];

    classDef llm fill:#f9d,stroke:#333,stroke-width:2px
    class C llm

    classDef important_logic fill:#lightblue,stroke:#333,stroke-width:2px
    class E,F,K important_logic

    classDef mode_handler fill:#e6ffe6,stroke:#333,stroke-width:1px
    class L,M,N,O,P mode_handler

```

## Diagram Explanation:

*   **Nodes (`NodeId["Label_Text"]`)**: Represent actions, decisions, or function calls within `routeInteraction`. Labels are quoted and use underscores for spaces to ensure rendering compatibility.
*   **`routeInteraction_Start`**: Entry point of the function.
*   **`Call_analyzeClientNeed_LLM`**: Represents the LLM call to determine user intent. (Highlighted in pink)
*   **Decisions (Blue菱形)**:
    *   `context_currentMode_is_IdleMode?`: Checks if the conversation is currently in `IdleMode`.
    *   `Evaluate_context_lastUserIntent_intent`: If in `IdleMode`, this checks the detected intent to decide on a mode transition.
    *   `Switch_on_context_currentMode`: The main `switch` statement that delegates to different mode handlers.
*   **Mode Handlers (Greenish boxes)**: Represent calls to specific functions like `handleBookingModeInteraction`, `handleFAQModeInteraction`, etc.
*   **`Return_{finalBotResponse_updatedContext}`**: The final output of the `routeInteraction` function.

This diagram focuses on the control flow and key decision points within your `main-conversation-manager.ts` file. 