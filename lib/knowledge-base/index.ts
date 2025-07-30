/**
 * Knowledge Base - SIMPLE VERSION
 * 
 * Two main functions:
 * 1. Create Skedy knowledge from form data + optional customer Q&A
 * 2. Generate customer template for additional policies
 */

// Knowledge creator (Skedy knowledge + customer Q&A)
export { 
  createKnowledgeBase, 
  saveKnowledgeBase,
  type KnowledgeOptions 
} from './knowledge-creator';

// Customer template (for additional policies)
export { 
  downloadCustomerTemplate,
  generateCustomerTemplate,
  getCustomerTemplate,
  type PolicyQuestion,
  type CustomerTemplate 
} from './customer-template';

// Dynamic system knowledge (used internally)
export { 
  generateBusinessSpecificSystemKnowledge,
  type BusinessConfiguration 
} from './dynamic-system-knowledge'; 