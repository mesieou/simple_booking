import { fetchAllDocuments, type BlogPost } from '@/lib/sanity'

export async function generateStaticParams() {
  try {
    const posts = await fetchAllDocuments<BlogPost>('post')
    
    return posts.map((post) => ({
      slug: post.slug.current,
    }))
  } catch (error) {
    console.error('Error generating static params for posts:', error)
    return []
  }
} 