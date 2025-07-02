import { CalendarIcon, ClockIcon, UserIcon, TagIcon } from 'lucide-react'
import Image from 'next/image'
import { urlFor } from '@/lib/sanity'
import { BlogPost } from './types'

interface BlogMetaProps {
  post: BlogPost
  variant?: 'default' | 'compact'
  className?: string
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

export const BlogMeta = ({ post, variant = 'default', className = '' }: BlogMetaProps) => {
  const readingTime = getReadingTime(post.body)

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-4 text-sm text-muted-foreground ${className}`}>
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
    )
  }

  // Default variant
  return (
    <div className={`space-y-4 ${className}`}>
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
            <p className="text-sm text-muted-foreground">Author</p>
          </div>
        </div>
      )}

      {/* Meta information */}
      <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
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

        {/* Categories */}
        {post.categories && post.categories.length > 0 && (
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5" />
            <div className="flex gap-1">
              {post.categories.map((category, index) => (
                <span key={category._id} className="text-sm">
                  {category.title}
                  {index < post.categories!.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 