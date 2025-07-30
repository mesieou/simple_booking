/**
 * Simple Knowledge Creator
 * 
 * Creates knowledge base from:
 * 1. Auto-generated Skedy knowledge (from form data)
 * 2. Optional customer Q&A (uploaded by user)
 */

import { generateBusinessSpecificSystemKnowledge, type BusinessConfiguration } from './dynamic-system-knowledge';
import { BusinessCategoryType } from '../config/business-templates';

export interface KnowledgeOptions {
  businessName: string;
  businessCategory: BusinessCategoryType;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  businessAddress: string;
  services: Array<{
    name: string;
    pricingType: 'fixed' | 'per_minute';
    fixedPrice?: number;
    baseCharge?: number;
    ratePerMinute?: number;
    description: string;
    durationEstimate: number;
    mobile: boolean;
  }>;
  numberOfProviders: number;
  depositType?: 'percentage' | 'fixed';
  depositPercentage?: number;
  depositFixedAmount?: number;
  preferredPaymentMethod: string;
}

/**
 * Create complete knowledge base
 */
export function createKnowledgeBase(options: KnowledgeOptions, customQandA?: string): string {
  // Create business configuration from options
  const businessConfig: BusinessConfiguration = {
    businessName: options.businessName,
    businessCategory: options.businessCategory,
    services: options.services,
    numberOfProviders: options.numberOfProviders,
    allowProviderSelection: false,
    acceptsOnlinePayments: true,
    acceptsCash: true,
    requiresDeposit: Boolean((options.depositType === 'percentage' && options.depositPercentage && options.depositPercentage > 0) ||
                     (options.depositType === 'fixed' && options.depositFixedAmount && options.depositFixedAmount > 0)),
    depositType: options.depositType || 'percentage',
    depositPercentage: options.depositType === 'percentage' ? options.depositPercentage : undefined,
    depositFixedAmount: options.depositType === 'fixed' ? options.depositFixedAmount : undefined,
    allowsTextBooking: true,
    requiresButtonBooking: false,
    whatsappNumber: options.whatsappNumber,
    responseTimeHours: 24,
    operatingHours: 'See calendar for availability',
    cancellationPolicy: 'See business policies',
    businessAddress: options.businessAddress,
    serviceAreas: ['Local area'],
    offersQuotes: true,
    offersInstantBooking: true,
    hasRealTimeAvailability: true
  };

  const skedyKnowledge = generateBusinessSpecificSystemKnowledge(businessConfig);
  
  // 2. Add customer Q&A if provided
  let knowledgeBase = skedyKnowledge;
  
  if (customQandA && customQandA.trim()) {
    knowledgeBase += `\n\n## Additional Business Information\n\n${customQandA}`;
  }
  
  return knowledgeBase;
}

/**
 * Save knowledge base to documents and process through PDF crawling system
 */
export async function saveKnowledgeBase(businessId: string, knowledgeBase: string): Promise<boolean> {
  try {
    console.log(`[Knowledge Base] Processing knowledge base for business ${businessId} (${knowledgeBase.length} characters)`);
    
    // Create a PDF from the knowledge base content
    const pdfBuffer = await createPdfFromText(knowledgeBase, 'Business Knowledge Base');
    console.log(`[Knowledge Base] Created PDF buffer (${pdfBuffer.length} bytes)`);
    
    // Use the PDF crawler system
    const { crawlAndProcessPdfs } = await import('@/lib/backend-actions/content-crawler/pdf-crawler');
    
    // Create crawl config for PDF processing
    const config = {
      businessId,
      pdfNames: ['business-knowledge-base.pdf'],
      concurrency: 1,
      maxPages: 50 // Allow multiple pages for large knowledge bases
    };
    
    // Process the PDF through the crawler system
    const result = await crawlAndProcessPdfs(config, [pdfBuffer]);
    
    if (result && result.pageCount > 0) {
      console.log(`[Knowledge Base] Successfully processed knowledge base PDF: ${result.pageCount} pages, ${result.uniqueParagraphs} paragraphs`);
      return true;
    } else {
      console.error(`[Knowledge Base] PDF crawler failed to process knowledge base: ${JSON.stringify(result)}`);
      return false;
    }
    
  } catch (error) {
    console.error(`[Knowledge Base] Error processing knowledge base for business ${businessId}:`, error);
    return false;
  }
}

/**
 * Create a PDF buffer from text content
 */
async function createPdfFromText(text: string, title: string): Promise<Buffer> {
  // Using a simple PDF generation approach - you might want to use a more sophisticated library
  // For now, let's use a basic approach that creates a simple PDF
  
  try {
    // Try to use jsPDF if available
    const { jsPDF } = await import('jspdf');
    
    const doc = new jsPDF();
    
    // Set title
    doc.setFontSize(16);
    doc.text(title, 20, 20);
    
    // Add content with word wrapping
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(text, 170); // Width of 170mm
    doc.text(lines, 20, 40);
    
    // Convert to buffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    return Buffer.from(pdfArrayBuffer);
    
  } catch (jsPdfError) {
    console.log('[Knowledge Base] jsPDF not available, using fallback PDF creation');
    
    // Fallback: Create a minimal PDF structure manually
    // This is a very basic PDF that should work for text content
    const pdfContent = createMinimalPdfContent(text, title);
    return Buffer.from(pdfContent);
  }
}

/**
 * Create a minimal PDF structure manually (fallback)
 */
function createMinimalPdfContent(text: string, title: string): string {
  // Very basic PDF structure - this is a simplified approach
  // In production, you'd want to use a proper PDF library
  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${text.length + title.length + 200}
>>
stream
BT
/F1 16 Tf
50 750 Td
(${title.replace(/[()\\]/g, '\\$&')}) Tj
0 -30 Td
/F1 12 Tf
(${text.replace(/[()\\]/g, '\\$&').substring(0, 2000)}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000348 00000 n 
0000000565 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
625
%%EOF`;

  return pdfHeader;
} 