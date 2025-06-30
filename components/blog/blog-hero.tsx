'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CalendarIcon, ClockIcon, ArrowRightIcon } from 'lucide-react'
import { urlFor } from '@/lib/sanity'
import { BlogPost } from './types'

interface BlogHeroProps {
  post: BlogPost
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

export const BlogHero = ({ post }: BlogHeroProps) => {
  const readingTime = getReadingTime(post.body)

  return (
    <section className="relative bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/5">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-6">
            {/* Categories */}
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.categories.map((category) => (
                  <span
                    key={category._id}
                    className="inline-block px-3 py-1 text-sm font-medium bg-primary/20 text-primary rounded-full"
                  >
                    {category.title}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              {post.title}
            </h1>

            {/* Description */}
            <p className="text-xl text-muted-foreground leading-relaxed">
              Discover insights, tips and best practices for managing your bookings 
              and appointments effectively.
            </p>

            {/* Meta information */}
            <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
              {/* Author */}
              {post.author && (
                <div className="flex items-center gap-3">
                  {post.author.image ? (
                    <Image
                      src={urlFor(post.author.image).url()}
                      alt={post.author.name || 'Author'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                      {getAuthorInitials(post.author.name)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">{post.author.name}</p>
                    <p className="text-sm">Author</p>
                  </div>
                </div>
              )}

              {/* Date */}
              {post.publishedAt && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </time>
                </div>
              )}

              {/* Reading time */}
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                <span>{readingTime} min read</span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <Link
                href={`/blog/${post.slug?.current}`}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Read Full Article
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Image */}
          {post.mainImage && (
            <div className="relative">
              <div className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={urlFor(post.mainImage).url()}
                  alt={post.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-secondary/20 rounded-full blur-xl" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}