import { Embedding } from '../models/embeddings';
import { DocumentData } from '../models/documents';

export async function createEmbeddings(documents: DocumentData[], numEmbeddings = 3) {
  const embeddings = [];
  for (const doc of documents) {
    // Skip documents without an ID
    if (!doc.id) {
      console.warn('Skipping embedding creation for document without ID');
      continue;
    }

    try {
      for (let i = 0; i < numEmbeddings; i++) {
        const emb = await Embedding.add({
          documentId: doc.id,
          content: doc.content || 'Chunk content',
          embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
          category: doc.category
        });
        embeddings.push(emb);
      }
    } catch (error) {
      console.error(`Failed to create embeddings for document ${doc.id}:`, error);
    }
  }
  return embeddings;
} 