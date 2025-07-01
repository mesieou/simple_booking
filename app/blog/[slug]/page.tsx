import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Clock, User, ArrowLeft, Tag } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { PortableText, ShareButton } from '@/components/blog'
import { fetchDocumentBySlug, fetchDocumentsWithReferences, type BlogPost } from '@/lib/sanity'
import { urlFor } from '@/lib/sanity'
import { executeCustomQuery, isSanityConfigured } from '@/lib/sanity'

interface PostPageProps {
  params: Promise<{ slug: string }>
}

export const metadata: Metadata = {
  title: 'Blog Post | Simple Booking',
  description: 'Read our latest blog post about bookings and appointment management.',
  keywords: ['blog', 'post', 'bookings', 'appointments'],
  openGraph: {
    title: 'Blog Post | Simple Booking',
    description: 'Read our latest blog post about bookings and appointment management.',
    type: 'article',
  },
}

export default async function PostPage({ params }: PostPageProps) {
  // Resolver los parámetros
  const { slug } = await params
  
  // Verificar configuración de Sanity
  if (!isSanityConfigured()) {
    console.error('Sanity is not properly configured')
    notFound()
  }

  try {
    const post = await executeCustomQuery<BlogPost>(`
      *[_type == "post" && slug.current == $slug][0] {
        _id,
        _type,
        title,
        slug,
        author->{
          _id,
          _type,
          name,
          image,
          bio
        },
        categories[]->{
          _id,
          _type,
          title,
          description
        },
        publishedAt,
        mainImage,
        body
      }
    `, { slug })
    
    // Debug: log del post para ver qué datos se están cargando
    console.log('Post data:', JSON.stringify(post, null, 2))
    console.log('Content type:', typeof post.body)
    console.log('Content is array:', Array.isArray(post.body))
    console.log('Content length:', post.body?.length)
    
    if (!post) {
      console.log('Post not found for slug:', slug)
      notFound()
    }

    // Verificar que el post tenga un slug válido
    if (!post.slug || !post.slug.current) {
      console.log('Post has no valid slug:', post)
      notFound()
    }

    const formatDate = (dateString: string) => {
      return format(new Date(dateString), 'dd MMMM yyyy', { locale: es })
    }

    const getReadingTime = (content: any[]) => {
      // Verificar si content existe y es un array
      if (!content || !Array.isArray(content)) {
        return 1 // Tiempo mínimo de lectura
      }
      // Estimación básica: 200 palabras por minuto
      const textContent = JSON.stringify(content) || ''
      const wordCount = textContent.split(' ').length
      return Math.max(1, Math.ceil(wordCount / 200)) // Mínimo 1 minuto
    }

    const getAuthorInitials = (name: string) => {
      // Verificar si name existe y es una cadena válida
      if (!name || typeof name !== 'string') {
        return '??' // Fallback para casos sin nombre
      }
      
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }

    // Get related posts (same categories, excluding current post)
    const relatedPosts = await executeCustomQuery<BlogPost[]>(`
      *[_type == "post" && slug.current != $slug && count(categories[]->{_id}[_id in $categoryIds]) > 0] | order(publishedAt desc) [0...3] {
        _id,
        _type,
        title,
        slug,
        mainImage,
        author->{_id, name, image},
        categories[]->{_id, title},
        publishedAt
      }
    `, { 
      slug, 
      categoryIds: post.categories?.map(cat => cat._id) || [] 
    })

    return (
      <div className="min-h-screen bg-background">
        {/* Header del post */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b">
          <div className="container mx-auto px-4 py-8">
            <Link 
              href="/blog" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al blog
            </Link>
            
            <div className="max-w-4xl mx-auto">
              {/* Categorías */}
              {post.categories && post.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.categories.map((category) => {
                    // Verificar si la categoría tiene título válido
                    if (!category.title) {
                      return null
                    }

                    return (
                      <Badge key={category._id} variant="secondary" className="hover:bg-primary hover:text-primary-foreground transition-colors">
                        {category.title}
                      </Badge>
                    )
                  })}
                </div>
              )}

              {/* Título */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
                {post.title}
              </h1>

              {/* Meta información */}
              <div className="flex flex-wrap items-center gap-6 text-muted-foreground mb-6">
                {post.author && (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={post.author.image ? urlFor(post.author.image).url() : undefined} />
                      <AvatarFallback className="text-sm">
                        {getAuthorInitials(post.author.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{post.author.name}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(post.publishedAt)}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{getReadingTime(post.body)} min de lectura</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Contenido del post */}
              <article className="lg:col-span-3">
                {/* Imagen destacada */}
                {post.mainImage && (
                  <div className="mb-8">
                    <Image
                      src={urlFor(post.mainImage).width(800).height(400).fit('crop').url()}
                      alt={post.title}
                      className="w-full h-auto rounded-lg shadow-lg"
                      width={800}
                      height={400}
                    />
                  </div>
                )}

                {/* Contenido Portable Text */}
                <div className="prose prose-lg max-w-none">
                  {post.body && Array.isArray(post.body) ? (
                    <PortableText content={post.body} />
                  ) : (
                    <p className="text-muted-foreground italic">
                      No hay contenido disponible para mostrar.
                    </p>
                  )}
                </div>

                {/* Botón de compartir */}
                <div className="mt-8 pt-8 border-t">
                  <ShareButton title={post.title} />
                </div>
              </article>

              {/* Sidebar */}
              <aside className="lg:col-span-1">
                <div className="sticky top-8 space-y-6">
                  {/* Información del autor */}
                  {post.author && (
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-semibold">Sobre el autor</h3>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={post.author.image ? urlFor(post.author.image).url() : undefined} />
                            <AvatarFallback>
                              {getAuthorInitials(post.author.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{post.author.name}</h4>
                            {post.author.bio && Array.isArray(post.author.bio) && post.author.bio.length > 0 && (
                              <div className="mt-1">
                                <PortableText content={post.author.bio} className="text-sm text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Información del artículo */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Información del artículo</h3>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha de publicación:</span>
                        <span>{formatDate(post.publishedAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tiempo de lectura:</span>
                        <span>{getReadingTime(post.body)} minutos</span>
                      </div>
                      {post.categories && post.categories.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Categorías:</span>
                          <span>{post.categories.length}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Related posts */}
                  {relatedPosts.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Related Posts</h3>
                      <div className="space-y-4">
                        {relatedPosts.map((relatedPost) => (
                          <Link
                            key={relatedPost._id}
                            href={`/blog/${relatedPost.slug?.current}`}
                            className="block group"
                          >
                            <div className="flex gap-3">
                              {relatedPost.mainImage && (
                                <Image
                                  src={urlFor(relatedPost.mainImage).url()}
                                  alt={relatedPost.title}
                                  width={80}
                                  height={60}
                                  className="rounded object-cover flex-shrink-0"
                                />
                              )}
                              <div>
                                <h4 className="font-medium group-hover:text-primary transition-colors line-clamp-2">
                                  {relatedPost.title}
                                </h4>
                                {relatedPost.publishedAt && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {new Date(relatedPost.publishedAt).toLocaleDateString('en-US', {
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
                  )}

                  {/* Newsletter signup */}
                  <div className="p-6 bg-primary/5 rounded-lg border">
                    <h3 className="font-semibold mb-2">Stay Updated</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get the latest posts and tips delivered to your inbox.
                    </p>
                    <div className="space-y-2">
                      <input
                        type="email"
                        placeholder="Enter your email"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                      <button className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                        Subscribe
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading post:', error)
    notFound()
  }
} 