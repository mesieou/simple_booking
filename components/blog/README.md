# Blog Components para Sanity CMS

Esta carpeta contiene todos los componentes necesarios para crear un blog completo usando Sanity CMS y los componentes UI existentes.

## Componentes Disponibles

### Componentes Principales

- **`BlogLayout`** - Layout principal que combina todos los elementos del blog
- **`BlogCard`** - Tarjeta individual para mostrar posts
- **`BlogList`** - Lista de posts con variantes grid y list
- **`BlogHero`** - Componente hero para posts destacados
- **`BlogSidebar`** - Sidebar con categorías, posts recientes y populares

### Componentes de Interacción

- **`BlogSearch`** - Búsqueda de posts con debounce
- **`BlogFilters`** - Filtros por categorías
- **`BlogPagination`** - Paginación de posts

### Componentes de Contenido

- **`PortableText`** - Renderizador para contenido Portable Text de Sanity

## Tipos TypeScript

Todos los tipos están definidos en `types.ts`:

- `BlogPost` - Tipo principal para posts del blog
- `BlogAuthor` - Tipo para autores
- `BlogCategory` - Tipo para categorías
- `BlogSettings` - Tipo para configuraciones del blog

## Uso Básico

### Importar componentes

```typescript
import {
  BlogLayout,
  BlogCard,
  BlogList,
  type BlogPost,
} from "@/components/blog";
```

### Usar el layout completo

```typescript
import { BlogLayout } from '@/components/blog'
import { fetchAllDocuments, fetchDocumentsWithReferences } from '@/lib/sanity'

export default async function BlogPage() {
  // Obtener posts con referencias resueltas
  const posts = await fetchDocumentsWithReferences<BlogPost>('post', ['author', 'categories'])

  // Obtener categorías
  const categories = await fetchAllDocuments<BlogCategory>('category')

  // Obtener posts recientes
  const recentPosts = await fetchOrderedDocuments<BlogPost>('post', '_createdAt', 'desc')

  return (
    <BlogLayout
      posts={posts}
      categories={categories}
      featuredPost={posts[0]} // Primer post como destacado
      recentPosts={recentPosts.slice(0, 5)}
      popularPosts={posts.slice(0, 5)}
    />
  )
}
```

### Usar componentes individuales

```typescript
import { BlogCard, BlogList, BlogSearch } from '@/components/blog'

// Tarjeta individual
<BlogCard post={post} variant="featured" />

// Lista de posts
<BlogList posts={posts} variant="grid" />

// Búsqueda
<BlogSearch onSearch={(query) => console.log(query)} />
```

## Configuración de Sanity

### Esquemas necesarios

Para que los componentes funcionen correctamente, necesitas estos esquemas en Sanity:

#### Post Schema

```javascript
export default {
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Título",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "excerpt",
      title: "Resumen",
      type: "text",
      rows: 3,
    },
    {
      name: "content",
      title: "Contenido",
      type: "array",
      of: [{ type: "block" }, { type: "image" }, { type: "code" }],
    },
    {
      name: "featuredImage",
      title: "Imagen destacada",
      type: "image",
      options: {
        hotspot: true,
      },
    },
    {
      name: "author",
      title: "Autor",
      type: "reference",
      to: [{ type: "author" }],
    },
    {
      name: "categories",
      title: "Categorías",
      type: "array",
      of: [{ type: "reference", to: [{ type: "category" }] }],
    },
    {
      name: "tags",
      title: "Etiquetas",
      type: "array",
      of: [{ type: "string" }],
    },
    {
      name: "publishedAt",
      title: "Fecha de publicación",
      type: "datetime",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "readingTime",
      title: "Tiempo de lectura (minutos)",
      type: "number",
    },
  ],
};
```

#### Author Schema

```javascript
export default {
  name: "author",
  title: "Autor",
  type: "document",
  fields: [
    {
      name: "name",
      title: "Nombre",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "name",
      },
    },
    {
      name: "bio",
      title: "Biografía",
      type: "text",
      rows: 3,
    },
    {
      name: "avatar",
      title: "Avatar",
      type: "image",
    },
    {
      name: "social",
      title: "Redes sociales",
      type: "object",
      fields: [
        { name: "twitter", title: "Twitter", type: "url" },
        { name: "linkedin", title: "LinkedIn", type: "url" },
        { name: "github", title: "GitHub", type: "url" },
        { name: "website", title: "Sitio web", type: "url" },
      ],
    },
  ],
};
```

#### Category Schema

```javascript
export default {
  name: "category",
  title: "Categoría",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Título",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
      },
    },
    {
      name: "description",
      title: "Descripción",
      type: "text",
      rows: 3,
    },
    {
      name: "color",
      title: "Color",
      type: "string",
    },
    {
      name: "image",
      title: "Imagen",
      type: "image",
    },
  ],
};
```

## Consultas GROQ Comunes

### Obtener posts con referencias

```typescript
import { fetchDocumentsWithReferences } from "@/lib/sanity";

const posts = await fetchDocumentsWithReferences<BlogPost>("post", [
  "author",
  "categories",
]);
```

### Obtener posts por categoría

```typescript
import { executeCustomQuery } from "@/lib/sanity";

const postsByCategory = await executeCustomQuery<BlogPost[]>(
  `
  *[_type == "post" && $category in categories[]->slug.current] {
    _id,
    _type,
    title,
    slug,
    excerpt,
    featuredImage,
    author->{_id, name, avatar},
    categories[]->{_id, title, slug},
    publishedAt,
    readingTime
  } | order(publishedAt desc)
`,
  { category: "tecnologia" }
);
```

### Obtener posts recientes

```typescript
import { fetchOrderedDocuments } from "@/lib/sanity";

const recentPosts = await fetchOrderedDocuments<BlogPost>(
  "post",
  "_createdAt",
  "desc"
);
```

## Personalización

### Estilos CSS

Los componentes usan Tailwind CSS y pueden ser personalizados agregando clases:

```typescript
<BlogCard
  post={post}
  className="custom-card-styles"
/>
```

### Variantes de componentes

Muchos componentes tienen variantes predefinidas:

```typescript
// BlogCard variants: 'default', 'featured', 'compact'
<BlogCard post={post} variant="featured" />

// BlogList variants: 'grid', 'list'
<BlogList posts={posts} variant="list" />
```

## Dependencias

Asegúrate de tener instaladas estas dependencias:

```bash
npm install @portabletext/react date-fns
```

## Ejemplos de Uso

### Página de blog completa

```typescript
// app/blog/page.tsx
import { BlogLayout } from '@/components/blog'
import { fetchAllDocuments, fetchDocumentsWithReferences } from '@/lib/sanity'

export default async function BlogPage() {
  const posts = await fetchDocumentsWithReferences<BlogPost>('post', ['author', 'categories'])
  const categories = await fetchAllDocuments<BlogCategory>('category')

  return (
    <BlogLayout
      posts={posts}
      categories={categories}
      featuredPost={posts[0]}
    />
  )
}
```

### Página de post individual

```typescript
// app/blog/[slug]/page.tsx
import { PortableText } from '@/components/blog'
import { fetchDocumentBySlug } from '@/lib/sanity'

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await fetchDocumentBySlug<BlogPost>('post', params.slug)

  if (!post) {
    return <div>Post no encontrado</div>
  }

  return (
    <article className="container mx-auto px-4 py-8">
      <h1>{post.title}</h1>
      <PortableText content={post.content} />
    </article>
  )
}
```

## Notas Importantes

1. **Imágenes**: Los componentes usan `urlFor` de Sanity para optimizar imágenes
2. **Fechas**: Se usa `date-fns` para formatear fechas en español
3. **Contenido**: Se usa `@portabletext/react` para renderizar contenido Portable Text
4. **Responsive**: Todos los componentes son responsive por defecto
5. **Accesibilidad**: Los componentes incluyen atributos de accesibilidad básicos

## Recursos Adicionales

- [Documentación de Sanity](https://www.sanity.io/docs)
- [Portable Text](https://portabletext.org/)
- [date-fns](https://date-fns.org/)
- [Tailwind CSS](https://tailwindcss.com/)
