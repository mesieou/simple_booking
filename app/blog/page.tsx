import { Metadata } from 'next'
import { BlogLayout } from '@/components/blog'
import { PageWithBreadcrumb } from "@/components/layout/page-with-breadcrumb"
import { 
  fetchAllDocuments, 
  fetchDocumentsWithReferences, 
  fetchOrderedDocuments,
  type BlogPost,
  type BlogCategory 
} from '@/lib/sanity'
import { executeCustomQuery } from '@/lib/sanity'

export const metadata: Metadata = {
  title: 'Blog | Simple Booking',
  description: 'Discover the latest news, tips and articles about bookings and appointment management.',
  keywords: ['blog', 'bookings', 'appointments', 'management', 'tips'],
  openGraph: {
    title: 'Blog | Simple Booking',
    description: 'Discover the latest news, tips and articles about bookings and appointment management.',
    type: 'website',
  },
}

export default async function BlogPage() {
  try {
    // Get posts with resolved references (author and categories)
    const posts = await executeCustomQuery<BlogPost[]>(`
      *[_type == "post"] {
        _id,
        _type,
        title,
        slug,
        mainImage,
        author->{_id, name, image},
        categories[]->{_id, title, description},
        publishedAt,
        body
      } | order(publishedAt desc)
    `)
    
    // Get categories
    const categories = await fetchAllDocuments<BlogCategory>('category')
    
    // Get recent posts (last 5)
    const recentPosts = await executeCustomQuery<BlogPost[]>(`
      *[_type == "post"] | order(_createdAt desc) [0...5] {
        _id,
        _type,
        title,
        slug,
        mainImage,
        author->{_id, name, image},
        publishedAt
      }
    `)
    
    // Get popular posts (you can implement popularity logic later)
    const popularPosts = posts.slice(0, 5)
    
    // Featured post (most recent)
    const featuredPost = posts.length > 0 ? posts[0] : undefined

    return (
      <PageWithBreadcrumb>
        <div className="min-h-screen bg-background/20">
          {/* Blog header */}
          <div className="border-b">
            <div className="container mx-auto px-4 py-12">
              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                  Our Blog
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Discover the latest news, tips and articles about bookings, 
                  appointment management and best practices for your business.
                </p>
              </div>
            </div>
          </div>

          {/* Main blog layout */}
          <BlogLayout
            posts={posts}
            categories={categories}
            featuredPost={featuredPost}
            recentPosts={recentPosts}
            popularPosts={popularPosts}
          />
        </div>
      </PageWithBreadcrumb>
    )
  } catch (error) {
    console.error('Error loading blog data:', error)
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error loading blog</h1>
          <p className="text-muted-foreground">
            Could not load posts. Please try again later.
          </p>
        </div>
      </div>
    )
  }
}
