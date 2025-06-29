'use client'

import { useState, useMemo } from 'react'
import { BlogCard } from './blog-card'
import { BlogHero } from './blog-hero'
import { BlogSidebar } from './blog-sidebar'
import { BlogFilters } from './blog-filters'
import { BlogPagination } from './blog-pagination'
import { BlogPost, BlogCategory } from './types'

interface BlogLayoutProps {
  posts: BlogPost[]
  categories: BlogCategory[]
  featuredPost?: BlogPost
  recentPosts: BlogPost[]
  popularPosts: BlogPost[]
}

const POSTS_PER_PAGE = 9

export const BlogLayout = ({
  posts,
  categories,
  featuredPost,
  recentPosts,
  popularPosts
}: BlogLayoutProps) => {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Filter posts based on category and search
  const filteredPosts = useMemo(() => {
    let filtered = posts

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(post =>
        post.categories?.some(cat => cat.title === selectedCategory)
      )
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(query) ||
        post.author?.name?.toLowerCase().includes(query) ||
        post.categories?.some(cat => cat.title.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [posts, selectedCategory, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const endIndex = startIndex + POSTS_PER_PAGE
  const currentPosts = filteredPosts.slice(startIndex, endIndex)

  // Reset to first page when filters change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setSelectedCategory('')
    setSearchQuery('')
    setCurrentPage(1)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Featured Post */}
      {featuredPost && (
        <div className="mb-12">
          <BlogHero post={featuredPost} />
        </div>
      )}

      {/* Filters */}
      <BlogFilters
        categories={categories}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        onCategoryChange={handleCategoryChange}
        onSearchChange={handleSearchChange}
        onClearFilters={handleClearFilters}
      />

      {/* Results count */}
      <div className="mb-6">
        <p className="text-muted-foreground">
          {filteredPosts.length === 0 ? 'No posts found' : 
           `Showing ${startIndex + 1}-${Math.min(endIndex, filteredPosts.length)} of ${filteredPosts.length} posts`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Main content */}
        <div className="lg:col-span-3">
          {currentPosts.length > 0 ? (
            <>
              {/* Posts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {currentPosts.map((post) => (
                  <BlogCard key={post._id} post={post} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <BlogPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2">No posts found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or browse all categories.
              </p>
              <button
                onClick={handleClearFilters}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <BlogSidebar
            categories={categories}
            recentPosts={recentPosts}
            popularPosts={popularPosts}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            onSearch={handleSearchChange}
          />
        </div>
      </div>
    </div>
  )
} 