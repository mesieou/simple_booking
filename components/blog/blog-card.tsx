'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CalendarIcon, ClockIcon, UserIcon } from 'lucide-react'
import { urlFor } from '@/lib/sanity'
import { BlogPost } from './types'

interface BlogCardProps {
  post: BlogPost
  variant?: 'default' | 'featured'
}

const getAuthorInitials = (name?: string) => {
  if (!name) return 'A'
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const getReadingTime = (body: any) => {
  // Simple estimation: 200 words per minute
  const wordCount = JSON.stringify(body).split(' ').length
  const minutes = Math.ceil(wordCount / 200)
  return minutes
}

export const BlogCard = ({ post, variant = 'default' }: BlogCardProps) => {
  const isFeatured = variant === 'featured'
  const readingTime = getReadingTime(post.body)

  return (
    <Link href={`/blog/${post.slug?.current}`} className="group">
      <article className={`bg-card rounded-lg overflow-hidden border transition-all duration-300 hover:shadow-lg ${
        isFeatured ? 'lg:col-span-2' : ''
      }`}>
        {/* Image */}
        {post.mainImage && (
          <div className={`relative overflow-hidden ${
            isFeatured ? 'h-64 lg:h-80' : 'h-48'
          }`}>
            <Image
              src={urlFor(post.mainImage).url()}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Categories */}
          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {post.categories.slice(0, 2).map((category) => (
                <span
                  key={category._id}
                  className="inline-block px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"
                >
                  {category.title}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h3 className={`font-bold mb-3 group-hover:text-primary transition-colors ${
            isFeatured ? 'text-xl lg:text-2xl' : 'text-lg'
          }`}>
            {post.title}
          </h3>

          {/* Meta information */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {/* Author */}
            {post.author && (
              <div className="flex items-center gap-2">
                {post.author.image ? (
                  <Image
                    src={urlFor(post.author.image).url()}
                    alt={post.author.name || 'Author'}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                    {getAuthorInitials(post.author.name)}
                  </div>
                )}
                <span>{post.author.name}</span>
              </div>
            )}

            {/* Date */}
            {post.publishedAt && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </time>
              </div>
            )}

            {/* Reading time */}
            <div className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              <span>{readingTime} min read</span>
            </div>
          </div>

          {/* Read more */}
          <div className="flex items-center text-primary font-medium text-sm group-hover:underline">
            Read more
            <svg
              className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </article>
    </Link>
  )
} 