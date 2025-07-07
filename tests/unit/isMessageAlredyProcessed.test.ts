// Is message already processed?

import { isMessageAlreadyProcessed, markMessageAsProcessed } from '@/lib/bot-engine/channels/whatsapp/message-deduplication';
// Input: messagen - string
// Output: boolean (yes or no)



describe('isMessage already processed?', () => {
    it('should return true for already processed message', () => {
        // function to test
        const messageId = 'test-message-123'
        const message = markMessageAsProcessed(messageId);
        const result = isMessageAlreadyProcessed(messageId);
        expect(result).toBe(true);
    });

    it('should return false for unprocessed message', () => {
        const messageId = 'test-message-234';
        const result = isMessageAlreadyProcessed(messageId);
        expect(result).toBe(false);
    }); 
});



