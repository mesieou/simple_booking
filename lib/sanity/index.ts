// Sanity CMS Configuration and Utilities
// Main export file for all Sanity-related functionality

// Client and configuration
export { 
  sanityClient, 
  imageBuilder, 
  urlFor, 
  getImageUrl, 
  getResponsiveImageUrl, 
  getOptimizedImageUrl,
  SanityImage,
  SanityDocument
} from './client'

// GROQ queries
export {
  getAllDocuments,
  getDocumentById,
  getPaginatedDocuments,
  getDocumentCount,
  getDocumentsWithImages,
  getDocumentsWithOptimizedImages,
  getDocumentsWithResponsiveImages,
  getDocumentsWithReferences,
  getDocumentsWithSlug,
  getDocumentBySlug,
  searchDocuments,
  getDocumentsByDateRange,
  getOrderedDocuments,
  getDocumentsWithSpecificFields,
  getDocumentsWithArrayReferences
} from './queries'

// Utility functions
export {
  fetchAllDocuments,
  fetchDocumentById,
  fetchPaginatedDocuments,
  fetchDocumentCount,
  fetchDocumentsWithImages,
  fetchDocumentsWithOptimizedImages,
  fetchDocumentsWithResponsiveImages,
  fetchDocumentsWithReferences,
  fetchDocumentsWithSlug,
  fetchDocumentBySlug,
  searchDocumentsByTerm,
  fetchDocumentsByDateRange,
  fetchOrderedDocuments,
  fetchDocumentsWithSpecificFields,
  fetchDocumentsWithArrayReferences,
  executeCustomQuery,
  isSanityConfigured,
  getSanityConfig
} from './utils'

// Default export for convenience
export { default } from './client' 