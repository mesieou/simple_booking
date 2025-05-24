import { ConfidenceEvaluation } from './confidenceEvaluator';
import { MoodAnalysisResult } from '../openai-core';

export interface BotFeedback {
  bot_message_id: string;
  user_id: string;
  session_id: string;
  feedback_type: 'wrong' | 'incomplete' | 'hallucinated' | 'needs clarification';
  suggested_reply: string;
  notes?: string;
  timestamp: string;
  original_bot_response: string;
  triggering_user_message: string;
}

interface FeedbackTrigger {
  shouldTrigger: boolean;
  reason: string;
  feedbackType?: BotFeedback['feedback_type'];
}

export function checkFeedbackTrigger(
  userMessage: string,
  moodResult: MoodAnalysisResult | undefined,
  confidenceEvaluation: ConfidenceEvaluation | null,
  botResponse: string
): FeedbackTrigger {
  // 1. Check for manual trigger
  if (userMessage.trim().startsWith('#feedback')) {
    return {
      shouldTrigger: true,
      reason: 'Manual feedback trigger',
      feedbackType: 'needs clarification'
    };
  }

  // 2. Check mood score
  if (moodResult && moodResult.score <= 4) {
    return {
      shouldTrigger: true,
      reason: `Low mood score: ${moodResult.score}/10 (${moodResult.category})`,
      feedbackType: 'needs clarification'
    };
  }

  // 3. Check confidence score
  if (confidenceEvaluation && confidenceEvaluation.confidence_score < 0.5) {
    // Determine feedback type based on confidence evaluation
    let feedbackType: BotFeedback['feedback_type'] = 'needs clarification';
    
    if (confidenceEvaluation.missing_information.length > 0) {
      feedbackType = 'incomplete';
    }
    if (confidenceEvaluation.context_match_score < 0.3) {
      feedbackType = 'hallucinated';
    }
    if (confidenceEvaluation.response_quality_score < 0.3) {
      feedbackType = 'wrong';
    }

    return {
      shouldTrigger: true,
      reason: `Low confidence score: ${confidenceEvaluation.confidence_score.toFixed(2)}`,
      feedbackType
    };
  }

  return {
    shouldTrigger: false,
    reason: 'No trigger conditions met'
  };
}

export function createFeedbackEntry(
  trigger: FeedbackTrigger,
  botMessageId: string,
  userId: string,
  sessionId: string,
  originalBotResponse: string,
  triggeringUserMessage: string
): BotFeedback {
  return {
    bot_message_id: botMessageId,
    user_id: userId,
    session_id: sessionId,
    feedback_type: trigger.feedbackType || 'needs clarification',
    suggested_reply: '', // This would be populated by a human reviewer
    notes: trigger.reason,
    timestamp: new Date().toISOString(),
    original_bot_response: originalBotResponse,
    triggering_user_message: triggeringUserMessage
  };
} 