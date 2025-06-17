import { ServiceData } from '../database/models/service';
import { Document } from '../database/models/documents';
import { generateEmbedding } from '@/lib/conversation-engine/llm-actions/chat-interactions/functions/embeddings';

/**
 * Takes structured service data and converts it into a natural language text paragraph.
 * This text is optimized for semantic search and for an LLM to generate answers from.
 * @param service The service data object.
 * @returns A string containing the descriptive text of the service.
 */
export function generateServiceDocumentContent(service: ServiceData): string {
    let priceDescription = '';
    if (service.pricingType === 'fixed' && service.fixedPrice !== undefined) {
        priceDescription = `The price is $${service.fixedPrice}.`;
    } else if (service.pricingType === 'per_minute' && service.ratePerMinute !== undefined) {
        const base = service.baseCharge ? `a base charge of $${service.baseCharge}` : '';
        const included = service.includedMinutes ? `the first ${service.includedMinutes} minutes included` : '';
        
        priceDescription = `The price is calculated at $${service.ratePerMinute} per minute`;

        if (base && included) {
            priceDescription += `, with ${base} and ${included}.`;
        } else if (base) {
            priceDescription += `, with ${base}.`;
        } else if (included) {
            priceDescription += `, with ${included}.`;
        } else {
            priceDescription += '.';
        }
    }

    const description = service.description || `A ${service.name} service offered by our salon.`;

    // We join all parts into a coherent text block.
    // The .trim().replace() ensures the text is clean without extra spaces.
    return `
      Service Name: ${service.name}.
      Description: ${description}
      The estimated duration for this service is ${service.durationEstimate} minutes.
      ${priceDescription}
      This service ${service.mobile ? 'is available for house calls' : 'is not available for house calls'}.
    `.trim().replace(/\s\s+/g, ' ');
}

/**
 * Creates a new document in the 'documents' table based on a newly created service.
 * @param service The service data, must include the 'id' of the newly created service.
 */
export async function syncServiceOnCreate(service: ServiceData): Promise<void> {
    console.log(`[Sync Process] Starting CREATE sync for serviceId: ${service.id}`);
    if (!service.id) {
        console.error("[Sync Process] Aborted: Service ID is missing.");
        return;
    }
    const content = generateServiceDocumentContent(service);
    console.log(`[Sync Process] Generated content for document.`);
    
    const embedding = await generateEmbedding(content);
    console.log(`[Sync Process] Generated embedding vector.`);

    const newDoc = await Document.add({
        businessId: service.businessId,
        serviceId: service.id,
        content: content,
        source: 'Business Service',
        type: 'service',
        title: service.name,
        category: 'Services',
        confidence: 1,
        embedding: embedding,
    });
    console.log(`[Sync Process] Successfully created document with new ID: ${newDoc.id}`);
}

/**
 * Updates an existing document when its corresponding service is updated.
 * If the document does not exist for some reason, it creates a new one.
 * @param service The updated service data, must include the 'id'.
 */
export async function syncServiceOnUpdate(service: ServiceData): Promise<void> {
    console.log(`[Sync Process] Starting UPDATE sync for serviceId: ${service.id}`);
    if (!service.id) {
        console.error("[Sync Process] Aborted: Service ID is missing.");
        return;
    }
    const existingDoc = await Document.findByServiceId(service.id);
    const newContent = generateServiceDocumentContent(service);
    console.log(`[Sync Process] Generated new content for potential update.`);

    if (existingDoc?.id) {
        const embedding = await generateEmbedding(newContent);
        console.log(`[Sync Process] Found existing document with ID: ${existingDoc.id}. Generated new embedding and proceeding with update.`);
        await Document.update(existingDoc.id, {
            content: newContent,
            title: service.name,
            businessId: service.businessId,
            category: 'Services',
            confidence: 1,
            embedding: embedding,
        });
        console.log(`[Sync Process] Successfully updated document ID: ${existingDoc.id}.`);
    } else {
        console.warn(`[Sync Process] Document for serviceId ${service.id} not found. Creating a new one instead.`);
        await syncServiceOnCreate(service);
    }
}

/**
 * Deletes a document from the 'documents' table when a service is deleted.
 * @param serviceId The ID of the service that has been deleted.
 */
export async function syncServiceOnDelete(serviceId: string): Promise<void> {
    console.log(`[Sync Process] Starting DELETE sync for serviceId: ${serviceId}`);
    const existingDoc = await Document.findByServiceId(serviceId);
    if (existingDoc?.id) {
        console.log(`[Sync Process] Found document ${existingDoc.id} to delete.`);
        await Document.delete(existingDoc.id);
        console.log(`[Sync Process] Successfully deleted document ID: ${existingDoc.id}.`);
    } else {
        console.warn(`[Sync Process] Could not find a document to delete for serviceId ${serviceId}. It might have been already deleted.`);
    }
} 