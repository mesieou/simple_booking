import { sanityClient } from './client'
import { 
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

// Utility functions for common Sanity operations

/**
 * Fetch all documents of a specific type
 */
export const fetchAllDocuments = async <T>(documentType: string): Promise<T[]> => {
  try {
    const query = getAllDocuments(documentType)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents:`, error)
    return []
  }
}

/**
 * Fetch a single document by ID
 */
export const fetchDocumentById = async <T>(documentType: string, id: string): Promise<T | null> => {
  try {
    const query = getDocumentById(documentType, id)
    return await sanityClient.fetch<T>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} document with ID ${id}:`, error)
    return null
  }
}

/**
 * Fetch documents with pagination
 */
export const fetchPaginatedDocuments = async <T>(
  documentType: string, 
  limit: number = 10, 
  offset: number = 0
): Promise<T[]> => {
  try {
    const query = getPaginatedDocuments(documentType, limit, offset)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching paginated ${documentType} documents:`, error)
    return []
  }
}

/**
 * Get total count of documents
 */
export const fetchDocumentCount = async (documentType: string): Promise<number> => {
  try {
    const query = getDocumentCount(documentType)
    return await sanityClient.fetch<number>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} count:`, error)
    return 0
  }
}

/**
 * Fetch documents with image references resolved
 */
export const fetchDocumentsWithImages = async <T>(documentType: string): Promise<T[]> => {
  try {
    const query = getDocumentsWithImages(documentType)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents with images:`, error)
    return []
  }
}

/**
 * Fetch documents with optimized images
 */
export const fetchDocumentsWithOptimizedImages = async <T>(
  documentType: string, 
  imageWidth: number = 800
): Promise<T[]> => {
  try {
    const query = getDocumentsWithOptimizedImages(documentType, imageWidth)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents with optimized images:`, error)
    return []
  }
}

/**
 * Fetch documents with responsive images
 */
export const fetchDocumentsWithResponsiveImages = async <T>(documentType: string): Promise<T[]> => {
  try {
    const query = getDocumentsWithResponsiveImages(documentType)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents with responsive images:`, error)
    return []
  }
}

/**
 * Fetch documents with references resolved
 */
export const fetchDocumentsWithReferences = async <T>(
  documentType: string, 
  referenceFields: string[]
): Promise<T[]> => {
  try {
    const query = getDocumentsWithReferences(documentType, referenceFields)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents with references:`, error)
    return []
  }
}

/**
 * Fetch documents with slug
 */
export const fetchDocumentsWithSlug = async <T>(documentType: string): Promise<T[]> => {
  try {
    const query = getDocumentsWithSlug(documentType)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents with slug:`, error)
    return []
  }
}

/**
 * Fetch a single document by slug
 */
export const fetchDocumentBySlug = async <T>(documentType: string, slug: string): Promise<T | null> => {
  try {
    const query = getDocumentBySlug(documentType, slug)
    return await sanityClient.fetch<T>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} document with slug ${slug}:`, error)
    return null
  }
}

/**
 * Search documents
 */
export const searchDocumentsByTerm = async <T>(
  documentType: string, 
  searchTerm: string
): Promise<T[]> => {
  try {
    const query = searchDocuments(documentType, searchTerm)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error searching ${documentType} documents:`, error)
    return []
  }
}

/**
 * Fetch documents by date range
 */
export const fetchDocumentsByDateRange = async <T>(
  documentType: string, 
  startDate: string, 
  endDate: string
): Promise<T[]> => {
  try {
    const query = getDocumentsByDateRange(documentType, startDate, endDate)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents by date range:`, error)
    return []
  }
}

/**
 * Fetch documents with custom ordering
 */
export const fetchOrderedDocuments = async <T>(
  documentType: string, 
  orderBy: string = '_createdAt', 
  orderDirection: 'asc' | 'desc' = 'desc'
): Promise<T[]> => {
  try {
    const query = getOrderedDocuments(documentType, orderBy, orderDirection)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ordered ${documentType} documents:`, error)
    return []
  }
}

/**
 * Fetch documents with specific fields only
 */
export const fetchDocumentsWithSpecificFields = async <T>(
  documentType: string, 
  fields: string[]
): Promise<T[]> => {
  try {
    const query = getDocumentsWithSpecificFields(documentType, fields)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents with specific fields:`, error)
    return []
  }
}

/**
 * Fetch documents with array references resolved
 */
export const fetchDocumentsWithArrayReferences = async <T>(
  documentType: string, 
  arrayField: string
): Promise<T[]> => {
  try {
    const query = getDocumentsWithArrayReferences(documentType, arrayField)
    return await sanityClient.fetch<T[]>(query)
  } catch (error) {
    console.error(`Error fetching ${documentType} documents with array references:`, error)
    return []
  }
}

/**
 * Execute a custom GROQ query
 */
export const executeCustomQuery = async <T>(query: string, params?: Record<string, any>): Promise<T> => {
  try {
    return await sanityClient.fetch<T>(query, params)
  } catch (error) {
    console.error('Error executing custom query:', error)
    throw error
  }
}

/**
 * Check if Sanity client is properly configured
 */
export const isSanityConfigured = (): boolean => {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  
  if (!projectId) {
    console.warn('NEXT_PUBLIC_SANITY_PROJECT_ID is not configured')
    return false
  }
  
  if (!dataset) {
    console.warn('NEXT_PUBLIC_SANITY_DATASET is not configured')
    return false
  }
  
  return true
}

/**
 * Get Sanity configuration info
 */
export const getSanityConfig = () => {
  return {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION,
    useCdn: process.env.NODE_ENV === 'production',
    hasToken: !!process.env.SANITY_API_TOKEN
  }
} 