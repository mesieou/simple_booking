/**
 * lib/conversation-engine/flows/faq/faq-steps.ts
 *
 * Placeholder step handlers for the customer FAQ flow.
 * These are intentionally left blank and will be implemented in the future.
 * They exist to prevent the system from crashing if the flow is triggered.
 */
import type { IndividualStepHandler } from '../../state-manager';

const placeholderHandler: IndividualStepHandler = {
  validateUserInput: async () => ({ isValidInput: true }),
  processAndExtractData: async (validatedInput, currentGoalData) => currentGoalData,
};

export const identifyUserQuestionHandler: IndividualStepHandler = { ...placeholderHandler };
export const searchKnowledgeBaseHandler: IndividualStepHandler = { ...placeholderHandler };
export const provideAnswerToUserHandler: IndividualStepHandler = { ...placeholderHandler };
export const checkUserSatisfactionHandler: IndividualStepHandler = { ...placeholderHandler }; 