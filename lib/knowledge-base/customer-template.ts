/**
 * Simple Customer Template
 * 
 * Template for additional Q&A that customers can fill out.
 * Contains only policy questions not covered by auto-generated Skedy knowledge.
 */

import { BusinessCategoryType } from '../config/business-templates';

export interface PolicyQuestion {
  question: string;
  placeholder: string;
}

export interface CustomerTemplate {
  businessCategory: BusinessCategoryType;
  questions: PolicyQuestion[];
}

// Core policy questions for all businesses
const CORE_POLICY_QUESTIONS: PolicyQuestion[] = [
  {
    question: "What is your cancellation and rescheduling policy?",
    placeholder: "Cancellations with 48+ hours notice receive a full refund. 24-48 hours notice: 50% refund. Less than 24 hours: deposit is forfeited. Rescheduling is free with 24+ hours notice."
  },
  {
    question: "What happens if customers are running late for their appointment?",
    placeholder: "Please call us if you're running more than 15 minutes late. We'll do our best to accommodate you, but appointments may need to be shortened or rescheduled."
  },
  {
    question: "What should customers do if they're not satisfied with the service?",
    placeholder: "If you're not completely satisfied, please contact us immediately. We'll arrange to return and fix any issues at no charge within 7 days of the original service."
  },
  {
    question: "What guarantee do you offer on your services?",
    placeholder: "We guarantee your complete satisfaction with our services. If you're not happy with any aspect of our work, please contact us within 48 hours and we'll make it right at no additional charge."
  },
  {
    question: "Are you insured and what happens if something gets damaged?",
    placeholder: "We carry full public liability insurance. We take full responsibility for any damage caused by our team. Please report any damage immediately and we'll handle the insurance claim process."
  },
  {
    question: "How should customers prepare for your service?",
    placeholder: "Please ensure clear access to all areas where we'll be working. Remove any fragile or valuable items from the immediate work area. Have all necessary keys and access codes ready."
  }
];

// Additional questions for removalists
const REMOVALIST_QUESTIONS: PolicyQuestion[] = [
  {
    question: "Can you move specialty items like pianos, artwork, or antiques?",
    placeholder: "Yes, we have experience moving pianos, artwork, antiques, and other specialty items. These require special handling and may incur additional charges. Please mention specialty items when requesting your quote."
  },
  {
    question: "How do you handle stairs, elevators, and difficult access?",
    placeholder: "We handle stairs up to 3 floors at no extra charge (additional floors incur $25 per floor). We book elevators when required and use protective padding."
  }
];

// Additional questions for salons
const SALON_QUESTIONS: PolicyQuestion[] = [
  {
    question: "What is your policy for color corrections or unsatisfactory results?",
    placeholder: "If you're not happy with your color, please contact us within 48 hours. We offer one complimentary color correction within 7 days of your original appointment."
  },
  {
    question: "Do you have policies about bringing children to appointments?",
    placeholder: "Children are welcome but must be supervised at all times. For longer services (colors, highlights), we recommend arranging childcare as chemical processes require your full attention."
  }
];

/**
 * Get customer template for a business category
 */
export function getCustomerTemplate(businessCategory: BusinessCategoryType): CustomerTemplate {
  let questions = [...CORE_POLICY_QUESTIONS];

  // Add category-specific questions
  if (businessCategory === 'removalist') {
    questions.push(...REMOVALIST_QUESTIONS);
  } else if (businessCategory === 'salon') {
    questions.push(...SALON_QUESTIONS);
  }

  return {
    businessCategory,
    questions
  };
}

/**
 * Generate customer template as .doc format
 */
export function generateCustomerTemplate(businessName: string, businessCategory: BusinessCategoryType): string {
  const template = getCustomerTemplate(businessCategory);
  const categoryDisplay = businessCategory === 'removalist' ? 'Removalist/Moving Services' : 
                         businessCategory === 'salon' ? 'Salon/Beauty Services' : 
                         (businessCategory as string).charAt(0).toUpperCase() + (businessCategory as string).slice(1);

  let content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${businessName} - Additional Q&A Template</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40pt; line-height: 1.6; }
        h1 { color: #2c3e50; text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 10pt; }
        h2 { color: #34495e; margin-top: 25pt; }
        .header-info { text-align: center; margin-bottom: 30pt; }
        .question { font-weight: bold; color: #495057; margin: 20pt 0 8pt 0; }
        .answer-box { background-color: #f8f9fa; border: 1px solid #ced4da; padding: 12pt; margin-bottom: 15pt; min-height: 60pt; }
        .placeholder { color: #6c757d; font-style: italic; }
    </style>
</head>
<body>

<h1>Additional Q&A Template</h1>

<div class="header-info">
    <h2>${businessName}</h2>
    <p><strong>Business Category:</strong> ${categoryDisplay}</p>
</div>



<h2>📋 Business Policy Questions</h2>
`;

  template.questions.forEach((q, index) => {
    content += `
<div class="question">${index + 1}. ${q.question}</div>
<div class="answer-box">
    <div class="placeholder">${q.placeholder}</div>
</div>
`;
  });

  content += `
</body>
</html>`;

  return content;
}

/**
 * Download customer template as .doc file
 */
export function downloadCustomerTemplate(businessName: string, businessCategory: BusinessCategoryType): void {
  const content = generateCustomerTemplate(businessName, businessCategory);
  const filename = `${businessName.replace(/[^a-z0-9]/gi, '_')}_Additional_QA_Template.doc`;
  
  const blob = new Blob([content], { type: 'application/msword' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 