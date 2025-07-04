# Detailed MVP Conversational Flow Diagram (v2 - ActiveGoals Array)

This diagram details the MVP architecture using an `activeGoals` array, emphasizing LLM analysis to manage focus and interruptions.

```mermaid
graph TD
    A["handleUserMessage_Start(userInput, context)"] --> B["Update_context_with_userInput_and_history"]
    
    B --> C_GetFocusedGoal["focusedGoal = GET_FOCUSED_GOAL_from_context_activeGoals_and_focusedGoalId"]
    
    C_GetFocusedGoal --> D_InitGoalCheck{"focusedGoal_IS_NULL_OR_COMPLETED?"}
    D_InitGoalCheck -- Yes --> E_CreateDefaultGoal["focusedGoal = CREATE_NEW_GOAL_DefaultServiceBooking"]
    E_CreateDefaultGoal --> F_AddAndFocusGoal["ADD_focusedGoal_to_activeGoals_and_SET_as_focusedGoalId"]
    D_InitGoalCheck -- No --> G_GetCurrentStep
    F_AddAndFocusGoal --> G_GetCurrentStep

    G_GetCurrentStep["currentStepDef = GET_STEP_DEFINITION_for_focusedGoal"] --> H_Analyze["llmAnalysis = CALL_analyzeUserText_LLM(userInput, currentStepDef, activeGoals, history)"]
    H_Analyze --> I_StoreAnalysis["context_lastLLMAnalysis = llmAnalysis"]

    I_StoreAnalysis --> J_ProcessAnalysis{"Process_llmAnalysis"}
    J_ProcessAnalysis -- "isButtonMatch_OR_isRelevantToFocusedGoal" --> K_ProcessStep["Process_Input_for_Focused_Goal_Step"]
    K_ProcessStep --> L_UpdateCollectedData["Update_focusedGoal_collectedData"]
    L_UpdateCollectedData --> M_GetNextStepId["nextStepId = currentStepDef_nextStepLogic(...)"]
    M_GetNextStepId --> N_TransitionCheck{"nextStepId_IS_END_GOAL?"}

    N_TransitionCheck -- Yes --> O_GoalComplete["Handle_Focused_Goal_Completion"]
    O_GoalComplete --> O1_MarkComplete["SET_focusedGoal_status_to_completed"]
    O1_MarkComplete --> P_CheckPaused["CHECK_FOR_OTHER_PAUSED_GOALS_in_activeGoals"]
    P_CheckPaused -- "PausedGoal_Exists" --> Q_PromptResumePaused["Bot_prompts_to_RESUME_most_relevant_pausedGoal_with_buttons"]
    Q_PromptResumePaused --> Z_Return["Return_BotResponse_and_UpdatedContext"]
    P_CheckPaused -- "No_PausedGoal" --> R_InformComplete["Bot_responds_with_completion_message_e.g_Start_Over_option"]
    R_InformComplete --> Z_Return

    N_TransitionCheck -- No --> S_NextStep["focusedGoal_currentStepId = nextStepId"]
    S_NextStep --> S1_GetNextStepDef["nextStepDef = GET_STEP_DEFINITION_for_new_currentStepId"]
    S1_GetNextStepDef --> S2_PrepareResponse["Prepare_BotResponse_with_nextStepDef_prompt_and_buttons"]
    S2_PrepareResponse --> Z_Return

    J_ProcessAnalysis -- "isNewGoalRequest_FAQ" --> T_HandleFAQ["Handle_FAQ_Request_as_New_Goal"]
    T_HandleFAQ --> T1_PauseFocused["IF_focusedGoal_exists_SET_focusedGoal_status_to_paused"]
    T1_PauseFocused --> T2_CreateFAQGoal["newFAQGoal = CREATE_NEW_GOAL_FrequentlyAskedQuestion(queryText)"]
    T2_CreateFAQGoal --> T3_AddAndFocusFAQ["ADD_newFAQGoal_to_activeGoals_and_SET_as_focusedGoalId"]
    T3_AddAndFocusFAQ --> T4_ProcessFAQ["faqAnswer = PROCESS_IMMEDIATE_GOAL(newFAQGoal)"]
    %% FAQ is often 1-step
    T4_ProcessFAQ --> T5_MarkFAQComplete["SET_newFAQGoal_status_to_completed"]
    T5_MarkFAQComplete --> P_CheckPaused
    %% After FAQ, check for original paused goal to resume

    J_ProcessAnalysis -- "isNewGoalRequest_Escalation" --> U_HandleEscalation["Handle_Escalation_Request_as_New_Goal"]
    U_HandleEscalation --> U1_PauseFocused["IF_focusedGoal_exists_SET_focusedGoal_status_to_paused"]
    U1_PauseFocused --> U2_CreateEscalateGoal["newEscalationGoal = CREATE_NEW_GOAL_HumanAgentEscalation(reason)"]
    U2_CreateEscalateGoal --> U3_AddAndFocusEscalate["ADD_newEscalationGoal_to_activeGoals_and_SET_as_focusedGoalId"]
    U3_AddAndFocusEscalate --> U4_ProcessEscalate["escalationResponse = PROCESS_IMMEDIATE_GOAL(newEscalationGoal)"]
    U4_ProcessEscalate --> U5_MarkEscalateComplete["SET_newEscalationGoal_status_to_completed"]
    %% Or it might be an ongoing state
    U5_MarkEscalateComplete --> U6_InformUser["Bot_responds_with_escalationResponse"]
    %% May not check paused goals if escalated
    U6_InformUser --> Z_Return

    J_ProcessAnalysis -- "Else_UnclearInput_for_FocusedGoal" --> V_RepromptFocused["Bot_responds_Im_sorry_IDK_and_re_prompts_focusedGoal_currentStepDef"]
    V_RepromptFocused --> Z_Return

    classDef llm fill:#f9d,stroke:#333,stroke-width:2px
    class H_Analyze llm

    classDef decision fill:#lightblue,stroke:#333,stroke-width:2px
    class D_InitGoalCheck, J_ProcessAnalysis, N_TransitionCheck, P_CheckPaused decision

    classDef goal_management fill:#e6ffe6,stroke:#333,stroke-width:1px
    class C_GetFocusedGoal, E_CreateDefaultGoal, F_AddAndFocusGoal, K_ProcessStep, L_UpdateCollectedData, M_GetNextStepId, O_GoalComplete, O1_MarkComplete, S_NextStep, S1_GetNextStepDef, S2_PrepareResponse goal_management
    
    classDef deviation_handling fill:#ffccdd,stroke:#333,stroke-width:1px
    class T_HandleFAQ, T1_PauseFocused, T2_CreateFAQGoal, T3_AddAndFocusFAQ, T4_ProcessFAQ, T5_MarkFAQComplete, U_HandleEscalation, U1_PauseFocused, U2_CreateEscalateGoal, U3_AddAndFocusEscalate, U4_ProcessEscalate, U5_MarkEscalateComplete, U6_InformUser deviation_handling

    classDef resume_logic fill:#lightyellow,stroke:#333,stroke-width:1px
    class Q_PromptResumePaused resume_logic
```

## Diagram Explanation:

*   **`activeGoals` Array**: The context now maintains an array of `UserGoal` objects.
*   **`focusedGoalId`**: Points to the goal in `activeGoals` that the bot is currently trying to advance.
*   **`CALL_analyzeUserText_LLM` (Pink Node H_Analyze)**: This is the critical LLM call. It takes the user input, the `focusedGoal`'s current step definition, and the list of all `activeGoals`.
    *   It determines if input matches the focused goal (button or relevant text).
    *   If not, it determines if it's a new goal request (FAQ, Escalation, etc.).
*   **Deviation Handling (Light Pink/Red Nodes)**: If `analyzeUserText` detects a new goal request (e.g., for an FAQ or Escalation):
    1.  The current `focusedGoal` (if any) has its status set to `'paused'`. 
    2.  A new goal (e.g., `FrequentlyAskedQuestion`) is created, added to `activeGoals`, and becomes the new `focusedGoalId`.
    3.  This new, typically short, goal is processed (e.g., FAQ answered).
    4.  After the deviation goal completes, the system checks for other `'paused'` goals (like the original one) and prompts for resumption (Light Yellow node `Q_PromptResumePaused`).
*   **Resumption**: If a goal completes and other goals were paused, the user is prompted to resume the most relevant paused goal.

This v2 diagram attempts to capture the more dynamic nature of managing multiple potential lines of inquiry via the `activeGoals` array, heavily relying on the LLM's ability to discern context and intent shifts. 