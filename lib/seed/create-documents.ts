import { faker } from '@faker-js/faker';
import { Document, DocumentData } from '../models/documents';
import { Business } from '../models/business';

export async function createDocuments(
  businesses: Business[],
  numDocs: number = 5
): Promise<DocumentData[]> {
  const documents: DocumentData[] = [];

  for (const business of businesses) {
    for (let i = 0; i < numDocs; i++) {
      const documentData: DocumentData = {
        businessId: business.id!,
        content: faker.lorem.paragraphs(3),
        title: faker.lorem.sentence(),
        type: faker.helpers.arrayElement(['policy', 'terms', 'guide', 'faq']),
        category: faker.helpers.arrayElement(['legal', 'operational', 'customer']),
        source: faker.helpers.arrayElement(['manual', 'import', 'generated'])
      };

      try {
        const document = await Document.add(documentData);
        documents.push(document);
      } catch (error) {
        console.error('Error creating document:', error);
      }
    }
  }

  return documents;
} 