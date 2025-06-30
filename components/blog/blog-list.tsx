'use client'

import { BlogCard } from './blog-card'
import { BlogPost } from './types'

interface BlogListProps {
  posts: BlogPost[]
  variant?: 'grid' | 'list' | 'compact'
  className?: string
}

export const BlogList = ({ posts, variant = 'grid', className = '' }: BlogListProps) => {
  if (posts.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-semibold mb-2">No posts found</h3>
        <p className="text-muted-foreground">
          No posts are available at the moment.
        </p>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-6 ${className}`}>
        {posts.map((post) => (
          <BlogCard key={post._id} post={post} variant="default" />
        ))}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`space-y-4 ${className}`}>
        {posts.map((post) => (
          <BlogCard key={post._id} post={post} variant="default" />
        ))}
      </div>
    )
  }

  // Default grid layout
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {posts.map((post) => (
        <BlogCard key={post._id} post={post} variant="default" />
      ))}
    </div>
  )
} 