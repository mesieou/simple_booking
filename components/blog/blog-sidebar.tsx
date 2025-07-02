'use client'

import Link from 'next/link'
import Image from 'next/image'
import { SearchIcon, CalendarIcon, TagIcon } from 'lucide-react'
import { urlFor } from '@/lib/sanity'
import { BlogPost, BlogCategory } from './types'

interface BlogSidebarProps {
  categories: BlogCategory[]
  recentPosts: BlogPost[]
  popularPosts: BlogPost[]
  selectedCategory?: string
  onCategoryChange?: (category: string) => void
  onSearch?: (query: string) => void
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

export const BlogSidebar = ({
  categories,
  recentPosts,
  popularPosts,
  selectedCategory,
  onCategoryChange,
  onSearch
}: BlogSidebarProps) => {
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const query = formData.get('search') as string
    if (onSearch && query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <aside className="space-y-8">
      {/* Search */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Search Posts</h3>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            name="search"
            placeholder="Search articles..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </form>
      </div>

      {/* Categories */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Categories</h3>
        <div className="space-y-2">
          <button
            onClick={() => onCategoryChange?.('')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              !selectedCategory
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
          >
            All Posts
          </button>
          {categories.map((category) => (
            <button
              key={category._id}
              onClick={() => onCategoryChange?.(category.title)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                selectedCategory === category.title
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{category.title}</span>
                <span className="text-xs opacity-70">
                  {/* You can add post count here if needed */}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Posts</h3>
        <div className="space-y-4">
          {recentPosts.map((post) => (
            <Link
              key={post._id}
              href={`/blog/${post.slug?.current}`}
              className="block group"
            >
              <div className="flex gap-3">
                {post.mainImage && (
                  <Image
                    src={urlFor(post.mainImage).url()}
                    alt={post.title}
                    width={60}
                    height={60}
                    className="rounded object-cover flex-shrink-0"
                  />
                )}
                <div>
                  <h4 className="font-medium group-hover:text-primary transition-colors line-clamp-2 text-sm">
                    {post.title}
                  </h4>
                  {post.publishedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Posts */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Popular Posts</h3>
        <div className="space-y-4">
          {popularPosts.map((post, index) => (
            <Link
              key={post._id}
              href={`/blog/${post.slug?.current}`}
              className="block group"
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-medium group-hover:text-primary transition-colors line-clamp-2 text-sm">
                    {post.title}
                  </h4>
                  {post.publishedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Newsletter Signup */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-2">Stay Updated</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Get the latest posts and tips delivered to your inbox.
        </p>
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            Subscribe
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Popular Tags</h3>
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category._id}
              href={`/blog?category=${encodeURIComponent(category.title)}`}
              className="inline-block px-3 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {category.title}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
} 