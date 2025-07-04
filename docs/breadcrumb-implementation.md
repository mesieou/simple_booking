# Breadcrumbs con Datos Estructurados

## Implementación Completa

### Archivos Creados:

- `lib/breadcrumb-utils.ts` - Utilidades para generar breadcrumbs
- `hooks/use-breadcrumb.ts` - Hook personalizado
- `components/ui/breadcrumb.tsx` - Componente visual
- `components/layout/page-with-breadcrumb.tsx` - Layout wrapper

### Uso Básico:

```tsx
// En cualquier página
import { PageWithBreadcrumb } from "@/components/layout/page-with-breadcrumb";

export default function MyPage() {
  return (
    <PageWithBreadcrumb>
      <main>
        <h1>Mi Página</h1>
      </main>
    </PageWithBreadcrumb>
  );
}
```

### Características:

- ✅ Breadcrumbs dinámicos basados en URL
- ✅ Datos estructurados JSON-LD automáticos
- ✅ Soporte multiidioma (español/inglés)
- ✅ Accesibilidad completa
- ✅ Integración con Next.js App Router

### Validación:

- Google Rich Results Test
- Schema.org Validator
- Search Console monitoring
