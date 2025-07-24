/**
 * Client-side knowledge base functions
 * 
 * These functions can be safely imported in client components.
 * DO NOT import server-only functions here.
 */

// Re-export only client-safe functions from customer-template
export { 
  downloadCustomerTemplate,
  generateCustomerTemplate,
  getCustomerTemplate,
  type PolicyQuestion,
  type CustomerTemplate 
} from './customer-template'; 