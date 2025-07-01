'use client'

import { PortableText as PortableTextComponent } from '@portabletext/react'
import { urlFor } from '@/lib/sanity'

interface PortableTextProps {
  content: any[]
  className?: string
}

const PortableText = ({ content, className = '' }: PortableTextProps) => {
  // Verificar si el contenido es válido
  if (!content || !Array.isArray(content) || content.length === 0) {
    return (
      <div className={`prose prose-lg max-w-none ${className}`}>
        <p className="text-muted-foreground italic">
          No hay contenido disponible para mostrar.
        </p>
      </div>
    )
  }

  const components = {
    types: {
      image: ({ value }: any) => {
        if (!value) return null
        
        return (
          <div className="my-8">
            <img
              src={urlFor(value).width(800).url()}
              alt={value.alt || 'Imagen del artículo'}
              className="w-full h-auto rounded-lg shadow-lg"
            />
            {value.caption && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                {value.caption}
              </p>
            )}
          </div>
        )
      },
      code: ({ value }: any) => {
        if (!value || !value.code) return null
        
        return (
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
            <code className="text-sm">{value.code}</code>
          </pre>
        )
      }
    },
    marks: {
      link: ({ children, value }: any) => {
        if (!value?.href) return children
        
        const target = (value.href || '').startsWith('http') ? '_blank' : undefined
        return (
          <a
            href={value.href}
            target={target}
            rel={target === '_blank' ? 'noopener noreferrer' : undefined}
            className="text-primary hover:underline"
          >
            {children}
          </a>
        )
      },
      strong: ({ children }: any) => {
        return <strong className="font-bold">{children}</strong>
      },
      em: ({ children }: any) => {
        return <em className="italic">{children}</em>
      },
      code: ({ children }: any) => {
        return <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>
      }
    },
    block: {
      h1: ({ children }: any) => {
        return <h1 className="text-3xl font-bold mt-8 mb-4">{children}</h1>
      },
      h2: ({ children }: any) => {
        return <h2 className="text-2xl font-bold mt-6 mb-3">{children}</h2>
      },
      h3: ({ children }: any) => {
        return <h3 className="text-xl font-bold mt-4 mb-2">{children}</h3>
      },
      h4: ({ children }: any) => {
        return <h4 className="text-lg font-bold mt-3 mb-2">{children}</h4>
      },
      normal: ({ children }: any) => {
        return <p className="mb-4 leading-relaxed">{children}</p>
      },
      blockquote: ({ children }: any) => {
        return (
          <blockquote className="border-l-4 border-primary pl-4 py-2 my-6 bg-muted/50 italic">
            {children}
          </blockquote>
        )
      }
    },
    list: {
      bullet: ({ children }: any) => {
        return <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
      },
      number: ({ children }: any) => {
        return <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>
      }
    },
    listItem: ({ children }: any) => {
      return <li className="leading-relaxed">{children}</li>
    }
  }

  try {
    return (
      <div className={`prose prose-lg max-w-none ${className}`}>
        <PortableTextComponent value={content} components={components} />
      </div>
    )
  } catch (error) {
    console.error('Error rendering PortableText:', error)
    return (
      <div className={`prose prose-lg max-w-none ${className}`}>
        <p className="text-muted-foreground italic">
          Error al cargar el contenido del artículo.
        </p>
      </div>
    )
  }
}

export { PortableText } 