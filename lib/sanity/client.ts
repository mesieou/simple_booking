import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

// Sanity client configuration
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-01-01'

// Only create client if projectId is available
export const sanityClient = projectId 
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: process.env.NODE_ENV === 'production', // Use CDN in production
      token: process.env.SANITY_API_TOKEN, // Only needed for write operations
    })
  : null

// Image URL builder for Sanity images (only if client exists)
export const imageBuilder = sanityClient ? imageUrlBuilder(sanityClient) : null

// Helper function to build image URLs
export const urlFor = (source: any) => {
  if (!imageBuilder) {
    console.warn('Sanity imageBuilder not available - projectId may not be configured')
    // Return a mock object that simulates the Sanity image builder API
    const mockBuilder = {
      width: () => mockBuilder,
      height: () => mockBuilder,
      fit: () => mockBuilder,
      quality: () => mockBuilder,
      format: () => mockBuilder,
      url: () => ''
    }
    return mockBuilder
  }
  return imageBuilder.image(source)
}

// Helper function to get image URL with specific dimensions
export const getImageUrl = (source: any, width: number, height?: number) => {
  if (!imageBuilder) {
    console.warn('Sanity imageBuilder not available - projectId may not be configured')
    return ''
  }
  return imageBuilder
    .image(source)
    .width(width)
    .height(height || width)
    .url()
}

// Helper function to get responsive image URLs
export const getResponsiveImageUrl = (source: any, sizes: number[]) => {
  if (!imageBuilder) {
    console.warn('Sanity imageBuilder not available - projectId may not be configured')
    return ''
  }
  // For responsive images, we'll return the largest size
  // You might want to implement a more sophisticated responsive image solution
  const maxSize = Math.max(...sizes)
  return imageBuilder
    .image(source)
    .width(maxSize)
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
  if (!imageBuilder) {
    console.warn('Sanity imageBuilder not available - projectId may not be configured')
    return ''
  }
  
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