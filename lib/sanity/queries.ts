// Common GROQ queries for Sanity CMS

// Basic query to get all documents of a specific type
export const getAllDocuments = (documentType: string) => `
  *[_type == "${documentType}"] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...
  }
`

// Query to get a single document by ID
export const getDocumentById = (documentType: string, id: string) => `
  *[_type == "${documentType}" && _id == "${id}"][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...
  }
`

// Query to get documents with pagination
export const getPaginatedDocuments = (documentType: string, limit: number = 10, offset: number = 0) => `
  *[_type == "${documentType}"] | order(_createdAt desc) [${offset}...${offset + limit}] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...
  }
`

// Query to get total count of documents
export const getDocumentCount = (documentType: string) => `
  count(*[_type == "${documentType}"])
`

// Query to get documents with image references resolved
export const getDocumentsWithImages = (documentType: string) => `
  *[_type == "${documentType}"] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...,
    "image": image.asset->url,
    "imageAlt": image.alt
  }
`

// Query to get documents with optimized images
export const getDocumentsWithOptimizedImages = (documentType: string, imageWidth: number = 800) => `
  *[_type == "${documentType}"] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...,
    "image": image.asset->url + "?w=${imageWidth}&h=${imageWidth}&fit=crop&crop=center",
    "imageAlt": image.alt
  }
`

// Query to get documents with multiple image sizes
export const getDocumentsWithResponsiveImages = (documentType: string) => `
  *[_type == "${documentType}"] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...,
    "image": {
      "original": image.asset->url,
      "thumbnail": image.asset->url + "?w=300&h=300&fit=crop&crop=center",
      "medium": image.asset->url + "?w=600&h=600&fit=crop&crop=center",
      "large": image.asset->url + "?w=1200&h=1200&fit=crop&crop=center"
    },
    "imageAlt": image.alt
  }
`

// Query to get documents with references resolved
export const getDocumentsWithReferences = (documentType: string, referenceFields: string[]) => {
  const referenceProjections = referenceFields.map(field => 
    `"${field}": ${field}->{_id, _type, title, name, slug}`
  ).join(', ')
  
  return `
    *[_type == "${documentType}"] {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      ...,
      ${referenceProjections}
    }
  `
}

// Query to get documents with slug
export const getDocumentsWithSlug = (documentType: string) => `
  *[_type == "${documentType}"] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    slug,
    ...
  }
`

// Query to get a single document by slug
export const getDocumentBySlug = (documentType: string, slug: string) => `
  *[_type == "${documentType}" && slug.current == "${slug}"][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    slug,
    ...
  }
`

// Query to get documents with search functionality
export const searchDocuments = (documentType: string, searchTerm: string) => `
  *[_type == "${documentType}" && (
    title match "*${searchTerm}*" ||
    description match "*${searchTerm}*" ||
    content match "*${searchTerm}*"
  )] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    title,
    description,
    ...
  }
`

// Query to get documents with date filtering
export const getDocumentsByDateRange = (documentType: string, startDate: string, endDate: string) => `
  *[_type == "${documentType}" && _createdAt >= "${startDate}" && _createdAt <= "${endDate}"] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...
  } | order(_createdAt desc)
`

// Query to get documents with custom ordering
export const getOrderedDocuments = (documentType: string, orderBy: string = '_createdAt', orderDirection: 'asc' | 'desc' = 'desc') => `
  *[_type == "${documentType}"] | order(${orderBy} ${orderDirection}) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...
  }
`

// Query to get documents with specific fields only
export const getDocumentsWithSpecificFields = (documentType: string, fields: string[]) => {
  const fieldProjections = fields.map(field => field).join(', ')
  
  return `
    *[_type == "${documentType}"] {
      _id,
      _type,
      ${fieldProjections}
    }
  `
}

// Query to get documents with array references resolved
export const getDocumentsWithArrayReferences = (documentType: string, arrayField: string) => `
  *[_type == "${documentType}"] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...,
    "${arrayField}": ${arrayField}[]->{_id, _type, title, name, slug}
  }
` 