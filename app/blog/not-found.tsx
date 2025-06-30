import Link from 'next/link'
import { ArrowLeft, Home, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function BlogNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* Icono de error */}
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Search className="w-12 h-12 text-muted-foreground" />
            </div>
          </div>

          {/* Título y descripción */}
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Página no encontrada
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Lo sentimos, la página que buscas no existe o ha sido movida.
          </p>

          {/* Tarjeta con sugerencias */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>¿Qué puedes hacer?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-left">
                <h3 className="font-semibold mb-2">Verificar la URL</h3>
                <p className="text-muted-foreground text-sm">
                  Asegúrate de que la dirección web esté escrita correctamente.
                </p>
              </div>
              <div className="text-left">
                <h3 className="font-semibold mb-2">Usar la búsqueda</h3>
                <p className="text-muted-foreground text-sm">
                  Busca el contenido que necesitas en nuestro blog.
                </p>
              </div>
              <div className="text-left">
                <h3 className="font-semibold mb-2">Navegar por categorías</h3>
                <p className="text-muted-foreground text-sm">
                  Explora nuestros artículos organizados por temas.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/blog">
              <Button className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Volver al blog
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Ir al inicio
              </Button>
            </Link>
          </div>

          {/* Información adicional */}
          <div className="mt-12 text-sm text-muted-foreground">
            <p>
              Si crees que esto es un error, por favor{' '}
              <Link href="/contact" className="text-primary hover:underline">
                contáctanos
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 