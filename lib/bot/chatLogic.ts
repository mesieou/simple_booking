// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import { createUserSchema } from "@/lib/bot/schemas";
import { systemPrompt } from "@/lib/bot/prompts";
import { User } from "@/lib/models/user";
import { executeChatCompletion, ChatMessage, OpenAIChatMessage, OpenAIChatCompletionResponse, MoodAnalysisResult } from "@/lib/helpers/openai/openai-core";
import { checkMessageAnswerability, ClarityCheckResult } from "@/lib/helpers/openai/functions/conversation";
import { analyzeSentiment } from "@/lib/helpers/openai/functions/sentiment";
import { processMoodAndCheckForAlert } from "@/lib/helpers/alertSystem";
import { enhancePromptForCategory, getClarificationThreshold, getCategoryFollowUp } from "@/lib/helpers/openai/functions/categoryHandler";
import { evaluateResponseConfidence, ConfidenceEvaluation } from "@/lib/helpers/openai/functions/confidenceEvaluator";
import { checkFeedbackTrigger, createFeedbackEntry, BotFeedback } from "@/lib/helpers/openai/functions/feedback";
import { generateEmbedding } from "@/lib/helpers/openai/functions/embeddings";

/**
 * Checks if a message needs clarification and returns an appropriate response if needed
 */
async function checkMessageClarity(message: string, history: ChatMessage[]): Promise<{needsClarification: boolean, response?: string}> {
  try {
    const answerabilityCheck = await checkMessageAnswerability(message, history);
    
    if (!answerabilityCheck.is_answerable && answerabilityCheck.clarification_prompt) {
      return {
        needsClarification: true,
        response: answerabilityCheck.clarification_prompt
      };
    }
    
    return { needsClarification: false };
  } catch (error) {
    console.error('Error checking message clarity:', error);
    return { needsClarification: false };
  }
}

// Central function: takes existing history, and returns new history
export async function handleChat(history: OpenAIChatMessage[]) {
    // Get the last user message
    const lastUserMessage = history
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    let answerabilityCheck: ClarityCheckResult | null = null;
    let moodResult: MoodAnalysisResult | undefined;
    let userMessageEmbedding: number[] | null = null;

    // If there's a user message, analyze its mood and check clarity in parallel, also generate embedding for the user message
    if (lastUserMessage) {
      // Generate embedding for the user message
      try {
        userMessageEmbedding = await generateEmbedding(lastUserMessage.content);
        console.log('[Embedding] Generated embedding for user message');
      } catch (error) {
        console.error('[Embedding] Error generating embedding:', error);
      }

      const [moodAnalysisResult, clarityCheck, answerabilityResult] = await Promise.all([
        // Mood analysis
        (async () => {
          try {
            const result = await analyzeSentiment(lastUserMessage.content);
            if (result !== undefined) {
              console.log(`[Mood Analysis] Message: "${lastUserMessage.content}"`);
              console.log(`[Mood Analysis] Score: ${result.score}/10 (${result.category}: ${result.description})`);
              
              // Check if we should alert an admin based on the mood score
              const tempUserId = history.length > 0 ? 
                `user_${history[0].content.substring(0, 10).replace(/\W/g, '')}_${new Date().toISOString().split('T')[0]}` : 
                `anonymous_${new Date().getTime()}`;
                
              const alertTriggered = processMoodAndCheckForAlert(tempUserId, result);
              
              if (alertTriggered) {
                console.log(`[ADMIN NOTIFICATION] Alert triggered for user ${tempUserId}`);
                console.log(`[ADMIN NOTIFICATION] Consider reaching out to this customer directly`);
              }
              
              return result;
            }
          } catch (error) {
            console.error('[Mood Analysis] Error:', error);
          }
          return undefined;
        })(),
        
        // Standard clarity check
        (async () => {
          const chatHistory = history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }));
          return await checkMessageClarity(lastUserMessage.content, chatHistory);
        })(),
        
        // Enhanced answerability check with categories
        (async () => {
          try {
            const chatHistory = history.filter(m => m.role !== 'system').map(m => ({
              role: m.role === 'function' ? 'assistant' as const : m.role as 'user' | 'assistant',
              content: m.content
            }));
            return await checkMessageAnswerability(lastUserMessage.content, chatHistory);
          } catch (error) {
            console.error('[Answerability Check] Error:', error);
            return null;
          }
        })()
      ]);

      // Store the mood result
      moodResult = moodAnalysisResult;

      // Store enhanced answerability check for later use
      answerabilityCheck = answerabilityResult;

      if (answerabilityCheck) {
        console.log(`[Answerability Check] Message: "${lastUserMessage.content}"`);
        console.log(`[Answerability Check] Is answerable: ${answerabilityCheck.is_answerable}`);
        console.log(`[Answerability Check] Category: ${answerabilityCheck.category}`);
        console.log(`[Answerability Check] Confidence: ${answerabilityCheck.confidence.toFixed(2)}`);
        
        // Get category-specific threshold
        const categoryThreshold = getClarificationThreshold(answerabilityCheck.category as any);
        
        // If the message is not answerable or has low confidence, ask for clarification
        if (!answerabilityCheck.is_answerable && answerabilityCheck.clarification_prompt) {
          // Use confidence-based decision making with category-specific thresholds
          const isVeryShort = lastUserMessage.content.trim().split(/\s+/).length <= 3;
          const isEarlyInConversation = history.filter(m => m.role === 'user').length <= 2;
          const isLowConfidence = answerabilityCheck.confidence < categoryThreshold;
          
          // Decide whether to clarify based on multiple factors
          if (isLowConfidence || (isVeryShort && isEarlyInConversation)) {
            // Use the provided clarification prompt or a category-specific follow-up
            const clarificationResponse = answerabilityCheck.clarification_prompt || 
              getCategoryFollowUp(answerabilityCheck.category as any);
            
            console.log(`[Category Handler] Using clarification for category: ${answerabilityCheck.category}`);
            console.log(`[Category Handler] Threshold: ${categoryThreshold}, Confidence: ${answerabilityCheck.confidence}`);
            
            return [...history, { role: 'assistant', content: clarificationResponse }];
          }
        }
      } else if (clarityCheck.needsClarification && clarityCheck.response) {
        // Fall back to the standard clarity check if enhanced check fails
        return [...history, { role: 'assistant', content: clarityCheck.response }];
      }

      // Add mood context if needed
      let moodContext = '';
      if (moodResult?.category === 'frustrated') {
        moodContext = `The user seems ${moodResult.description}. Be extra patient, understanding, and solution-focused in your response.`;
      }
    }

    // Proceed with normal processing if no clarification is needed
    
    // Enhance the system prompt based on the message category if available
    let enhancedPrompt = systemPrompt;
    if (answerabilityCheck && answerabilityCheck.category) {
      enhancedPrompt = enhancePromptForCategory(systemPrompt, answerabilityCheck.category as any);
      console.log(`[Category Handler] Enhanced prompt for category: ${answerabilityCheck.category}`);
    }
    
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: enhancedPrompt },
      ...history.map(msg => {
        if (msg.role === 'function') {
          return {
            role: 'function' as const,
            name: msg.name,
            content: msg.content
          };
        }
        return {
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content
        };
      })
    ];
    
    // Check if GPT wants to call a function
    const completion = await executeChatCompletion(messages, "gpt-4o", 0.3, 1000, [createUserSchema]);
    const msg = completion.choices[0].message;

    // Evaluate confidence of the response
    let confidenceEvaluation: ConfidenceEvaluation | null = null;
    if (lastUserMessage && msg.content) {
      try {
        // Get retrieved context from the conversation history
        const retrievedContext = history
          .filter(m => m.role === 'assistant')
          .map(m => m.content)
          .slice(-3); // Use last 3 assistant messages as context

        confidenceEvaluation = await evaluateResponseConfidence(
          lastUserMessage.content,
          msg.content,
          retrievedContext
        );

        // Log confidence evaluation results
        console.log('[Confidence Evaluation] Results:');
        console.log(`[Confidence Evaluation] Overall Score: ${confidenceEvaluation.confidence_score.toFixed(2)}`);
        console.log(`[Confidence Evaluation] Context Match: ${confidenceEvaluation.context_match_score.toFixed(2)}`);
        console.log(`[Confidence Evaluation] Response Quality: ${confidenceEvaluation.response_quality_score.toFixed(2)}`);
        console.log(`[Confidence Evaluation] Reason: ${confidenceEvaluation.confidence_reason}`);
        if (confidenceEvaluation.missing_information.length > 0) {
          console.log(`[Confidence Evaluation] Missing Information: ${confidenceEvaluation.missing_information.join(', ')}`);
        }

        // Check if feedback should be triggered
        const feedbackTrigger = checkFeedbackTrigger(
          lastUserMessage.content,
          moodResult,
          confidenceEvaluation,
          msg.content
        );

        if (feedbackTrigger.shouldTrigger) {
          console.log('[Feedback System] Trigger detected:', feedbackTrigger.reason);
          
          // Create feedback entry
          const feedbackEntry = createFeedbackEntry(
            feedbackTrigger,
            `msg_${Date.now()}`, // bot_message_id
            `user_${history[0].content.substring(0, 10).replace(/\W/g, '')}_${new Date().toISOString().split('T')[0]}`, // user_id
            `session_${Date.now()}`, // session_id
            msg.content, // original_bot_response
            lastUserMessage.content // triggering_user_message
          );

          // Log feedback entry
          console.log('[Feedback System] Created feedback entry:', feedbackEntry);

          // Add feedback request to the response
          const feedbackPrompt = `I notice my response might not be fully addressing your needs. Could you please let me know if this was helpful? Your feedback will help me improve.`;
          msg.content = `${msg.content}\n\n${feedbackPrompt}`;
        }
      } catch (error) {
        console.error('[Confidence Evaluation] Error:', error);
      }
    }

    // === Create User ===
    if (msg.function_call?.name === "createUser") {
        const {firstName, lastName} = JSON.parse(msg.function_call.arguments || "{}");

        try {
            // Create a new user with customer role and hardcoded business ID
            const user = new User(
                firstName,
                lastName,
                "customer",
                "5daa4f28-1ade-491b-be8b-b80025ffc2c4"  // hardcoded business ID
            );

            // Add the user to the database
            const result = await user.add();

            // Push the function call and result to history
            history.push({ 
                role: 'assistant', 
                content: msg.content || '',
                function_call: msg.function_call
            });
            history.push({
                role: "function",
                name: "createUser",
                content: JSON.stringify({
                    success: true, 
                    userId: result.data.id
                }),
            });

        } catch (err) {
            console.error("User creation error:", err);
            history.push({ 
                role: 'assistant', 
                content: msg.content || '',
                function_call: msg.function_call
            });
            history.push({
                role: "function",
                name: "createUser",
                content: JSON.stringify({ 
                    success: false, 
                    error: (err as any).message || String(err)
                }),
            });
        }

        // After function runs, GPT needs to respond again
        const followUp = await executeChatCompletion([{ role: "system", content: enhancedPrompt}, ...history], "gpt-4o");
        history.push({ 
            role: 'assistant', 
            content: followUp.choices[0].message.content || '' 
        });
        return history;
    }

    // Add the response to history with confidence evaluation metadata
    const responseMessage: OpenAIChatMessage = {
      role: 'assistant',
      content: msg.content || '',
      function_call: msg.function_call
    };

    // Add confidence evaluation metadata if available
    if (confidenceEvaluation) {
      responseMessage.metadata = {
        confidence: {
          overall: confidenceEvaluation.confidence_score,
          contextMatch: confidenceEvaluation.context_match_score,
          responseQuality: confidenceEvaluation.response_quality_score,
          reason: confidenceEvaluation.confidence_reason,
          missingInformation: confidenceEvaluation.missing_information
        }
      };
    }

    return [...history, responseMessage];
}

