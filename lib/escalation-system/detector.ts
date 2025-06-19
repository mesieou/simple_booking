/**
 * Escalation Detector
 * 
 * This module has a single responsibility: to detect if a user's message
 * explicitly requests human intervention. It is designed to be completely
 * independent of any specific conversation engine's intent classification.
 */

// Keywords and patterns that signal a request for human escalation.
// This list can be expanded and refined over time.
const ESCALATION_TRIGGERS: string[] = [
    'talk to a person',
    'talk to a human',
    'talk to someone',
    'I need an agent',
    'connect with an agent',
    'human help',
    'human assistance',
    'operator',
    'representative',
    'real person'
];

// More complex patterns can be handled with regular expressions.
const ESCALATION_PATTERNS: RegExp[] = [
    /I want (.*) (person|human|someone)/i,
    /I can (.*) (person|human|someone)/i,
    /I need (.*) (person|human|someone)/i
];

export class EscalationDetector {
    
    /**
     * Checks if a user's message contains a request for human escalation.
     * This function is pure and has no side effects. It only analyzes text.
     * 
     * @param userMessage The raw text from the user.
     * @returns `true` if an escalation request is detected, otherwise `false`.
     */
    public static isEscalationRequired(userMessage: string): boolean {
        if (!userMessage) {
            return false;
        }

        const lowerCaseMessage = userMessage.toLowerCase().trim();

        // Check for simple keyword triggers
        const hasTrigger = ESCALATION_TRIGGERS.some(trigger => lowerCaseMessage.includes(trigger));
        if (hasTrigger) {
            return true;
        }

        // Check for more complex regex patterns
        const hasPattern = ESCALATION_PATTERNS.some(pattern => pattern.test(lowerCaseMessage));
        if (hasPattern) {
            return true;
        }

        return false;
    }
} 