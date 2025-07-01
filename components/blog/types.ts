import { SanityImage, SanityDocument } from '@/lib/sanity'

// Tipos para el blog de Sanity

export interface BlogPost extends SanityDocument {
  _type: 'post'
  title: string
  slug: { current: string }
  body: any[] // Portable Text content (blockContent)
  mainImage?: SanityImage
  author?: BlogAuthor
  categories?: BlogCategory[]
  publishedAt: string
  seo?: {
    title?: string
    description?: string
    keywords?: string[]
  }
}

export interface BlogAuthor extends SanityDocument {
  _type: 'author'
  name: string
  slug: { current: string }
  image?: SanityImage
  bio?: any[] // Portable Text content
}

export interface BlogCategory extends SanityDocument {
  _type: 'category'
  title: string
  description?: string
}

export interface BlogSettings extends SanityDocument {
  _type: 'blogSettings'
  title: string
  description?: string
  logo?: SanityImage
  featuredPosts?: BlogPost[]
  categories?: BlogCategory[]
  social?: {
    twitter?: string
    linkedin?: string
    github?: string
    instagram?: string
  }
}

// Tipos para componentes del blog

export interface BlogCardProps {
  post: BlogPost
  variant?: 'default' | 'featured' | 'compact'
  className?: string
}

export interface BlogListProps {
  posts: BlogPost[]
  variant?: 'grid' | 'list'
  className?: string
}

export interface BlogHeroProps {
  post: BlogPost
  className?: string
}

export interface BlogSidebarProps {
  categories?: BlogCategory[]
  recentPosts?: BlogPost[]
  popularPosts?: BlogPost[]
  className?: string
}

export interface BlogSearchProps {
  onSearch: (query: string) => void
  placeholder?: string
  className?: string
}

export interface BlogPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export interface BlogFiltersProps {
  categories?: BlogCategory[]
  selectedCategory?: string
  onCategoryChange: (category: string) => void
  className?: string
}

export interface BlogLayoutProps {
  posts: BlogPost[]
  categories?: BlogCategory[]
  featuredPost?: BlogPost
  recentPosts?: BlogPost[]
  popularPosts?: BlogPost[]
  className?: string
}

export interface PortableTextProps {
  content: any[]
  className?: string
} 