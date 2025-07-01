# Sanity CMS Configuration

Esta carpeta contiene la configuración completa para integrar Sanity CMS con tu aplicación Next.js.

## Archivos

- `client.ts` - Configuración del cliente de Sanity y utilidades para imágenes
- `queries.ts` - Consultas GROQ comunes y reutilizables
- `utils.ts` - Funciones de utilidad para operaciones comunes
- `index.ts` - Archivo de exportación principal

## Configuración de Variables de Entorno

Agrega las siguientes variables a tu archivo `.env.local`:

```env
# Sanity Configuration
NEXT_PUBLIC_SANITY_PROJECT_ID=tu_project_id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2024-01-01

# Token para operaciones de escritura (opcional)
SANITY_API_TOKEN=tu_api_token
```

## Uso Básico

### Importar el cliente

```typescript
import { sanityClient, urlFor } from "@/lib/sanity";
```

### Obtener todos los documentos de un tipo

```typescript
import { fetchAllDocuments } from "@/lib/sanity";

const posts = await fetchAllDocuments<Post>("post");
```

### Obtener un documento por ID

```typescript
import { fetchDocumentById } from "@/lib/sanity";

const post = await fetchDocumentById<Post>("post", "post-id");
```

### Obtener un documento por slug

```typescript
import { fetchDocumentBySlug } from "@/lib/sanity";

const post = await fetchDocumentBySlug<Post>("post", "mi-post-slug");
```

### Obtener documentos con imágenes optimizadas

```typescript
import { fetchDocumentsWithOptimizedImages } from "@/lib/sanity";

const posts = await fetchDocumentsWithOptimizedImages<Post>("post", 800);
```

### Obtener documentos con paginación

```typescript
import { fetchPaginatedDocuments } from "@/lib/sanity";

const posts = await fetchPaginatedDocuments<Post>("post", 10, 0); // 10 posts, offset 0
```

## Utilidades de Imágenes

### Construir URL de imagen básica

```typescript
import { urlFor } from "@/lib/sanity";

const imageUrl = urlFor(imageData).url();
```

### Obtener imagen con dimensiones específicas

```typescript
import { getImageUrl } from "@/lib/sanity";

const imageUrl = getImageUrl(imageData, 800, 600);
```

### Obtener imagen optimizada

```typescript
import { getOptimizedImageUrl } from "@/lib/sanity";

const imageUrl = getOptimizedImageUrl(imageData, {
  width: 800,
  height: 600,
  quality: 80,
  format: "webp",
  fit: "crop",
});
```

### Obtener imagen responsive

```typescript
import { getResponsiveImageUrl } from "@/lib/sanity";

const imageUrl = getResponsiveImageUrl(imageData, [300, 600, 1200]);
```

## Consultas GROQ Personalizadas

### Ejecutar consulta personalizada

```typescript
import { executeCustomQuery } from "@/lib/sanity";

const customQuery = `
  *[_type == "post" && published == true] {
    _id,
    title,
    "author": author->name,
    "category": category->title
  }
`;

const posts = await executeCustomQuery<Post[]>(customQuery);
```

## Búsqueda

### Buscar documentos por término

```typescript
import { searchDocumentsByTerm } from "@/lib/sanity";

const results = await searchDocumentsByTerm<Post>("post", "react");
```

## Filtrado por Fecha

### Obtener documentos por rango de fechas

```typescript
import { fetchDocumentsByDateRange } from "@/lib/sanity";

const posts = await fetchDocumentsByDateRange<Post>(
  "post",
  "2024-01-01",
  "2024-12-31"
);
```

## Ordenamiento

### Obtener documentos ordenados

```typescript
import { fetchOrderedDocuments } from "@/lib/sanity";

const posts = await fetchOrderedDocuments<Post>("post", "title", "asc");
```

## Referencias

### Obtener documentos con referencias resueltas

```typescript
import { fetchDocumentsWithReferences } from "@/lib/sanity";

const posts = await fetchDocumentsWithReferences<Post>("post", [
  "author",
  "category",
]);
```

### Obtener documentos con referencias de array

```typescript
import { fetchDocumentsWithArrayReferences } from "@/lib/sanity";

const posts = await fetchDocumentsWithArrayReferences<Post>("post", "tags");
```

## Verificación de Configuración

### Verificar si Sanity está configurado

```typescript
import { isSanityConfigured, getSanityConfig } from "@/lib/sanity";

if (!isSanityConfigured()) {
  console.error("Sanity no está configurado correctamente");
}

const config = getSanityConfig();
console.log("Configuración de Sanity:", config);
```

## Tipos TypeScript

### Definir tipos para tus documentos

```typescript
interface Post {
  _id: string;
  _type: "post";
  title: string;
  slug: { current: string };
  content: any[];
  author: { _ref: string };
  publishedAt: string;
  image?: SanityImage;
}

// Usar con las funciones de fetch
const posts = await fetchAllDocuments<Post>("post");
```

## Ejemplos de Uso en Componentes React

### Componente que muestra posts

```typescript
import { fetchAllDocuments, urlFor } from '@/lib/sanity'

interface Post {
  _id: string
  title: string
  image: SanityImage
  slug: { current: string }
}

export default async function PostsList() {
  const posts = await fetchAllDocuments<Post>('post')

  return (
    <div>
      {posts.map((post) => (
        <div key={post._id}>
          <h2>{post.title}</h2>
          {post.image && (
            <img
              src={urlFor(post.image).width(400).url()}
              alt={post.title}
            />
          )}
        </div>
      ))}
    </div>
  )
}
```

### Componente de búsqueda

```typescript
'use client'

import { searchDocumentsByTerm } from '@/lib/sanity'
import { useState } from 'react'

export default function SearchPosts() {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<Post[]>([])

  const handleSearch = async () => {
    if (searchTerm.trim()) {
      const searchResults = await searchDocumentsByTerm<Post>('post', searchTerm)
      setResults(searchResults)
    }
  }

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Buscar posts..."
      />
      <button onClick={handleSearch}>Buscar</button>

      {results.map((post) => (
        <div key={post._id}>
          <h3>{post.title}</h3>
        </div>
      ))}
    </div>
  )
}
```

## Notas Importantes

1. **CDN**: En producción, las imágenes se sirven desde el CDN de Sanity para mejor rendimiento
2. **Tokens**: El token de API solo es necesario para operaciones de escritura
3. **Tipos**: Siempre define tipos TypeScript para mejor experiencia de desarrollo
4. **Manejo de errores**: Todas las funciones de utilidad incluyen manejo de errores
5. **Optimización**: Usa las funciones de imagen optimizadas para mejor rendimiento

## Recursos Adicionales

- [Documentación oficial de Sanity](https://www.sanity.io/docs)
- [GROQ Query Language](https://www.sanity.io/docs/groq)
- [Sanity Image URL Builder](https://www.sanity.io/docs/image-url)
- [Next.js con Sanity](https://www.sanity.io/docs/nextjs)
