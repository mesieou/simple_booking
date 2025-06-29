import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

// Sanity client configuration
export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-01-01',
  useCdn: process.env.NODE_ENV === 'production', // Use CDN in production
  token: process.env.SANITY_API_TOKEN, // Only needed for write operations
})

// Image URL builder for Sanity images
export const imageBuilder = imageUrlBuilder(sanityClient)

// Helper function to build image URLs
export const urlFor = (source: any) => {
  return imageBuilder.image(source)
}

// Helper function to get image URL with specific dimensions
export const getImageUrl = (source: any, width: number, height?: number) => {
  return imageBuilder
    .image(source)
    .width(width)
    .height(height || width)
    .url()
}

// Helper function to get responsive image URLs
export const getResponsiveImageUrl = (source: any, sizes: number[]) => {
  return imageBuilder
    .image(source)
    .sizes(sizes.map(size => `${size}px`).join(', '))
    .url()
}

// Helper function to get optimized image URL
export const getOptimizedImageUrl = (source: any, options: {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpg' | 'png'
  fit?: 'clip' | 'crop' | 'fill' | 'fillmax' | 'max' | 'scale' | 'min'
}) => {
  let builder = imageBuilder.image(source)
  
  if (options.width) builder = builder.width(options.width)
  if (options.height) builder = builder.height(options.height)
  if (options.quality) builder = builder.quality(options.quality)
  if (options.format) builder = builder.format(options.format)
  if (options.fit) builder = builder.fit(options.fit)
  
  return builder.url()
}

// Type definitions for better TypeScript support
export interface SanityImage {
  _type: 'image'
  asset: {
    _ref: string
    _type: 'reference'
  }
  alt?: string
  caption?: string
}

export interface SanityDocument {
  _id: string
  _type: string
  _createdAt: string
  _updatedAt: string
  _rev: string
}

// Export default client for convenience
export default sanityClient 