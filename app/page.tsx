import HeroContent from '@/components/sections/hero-content';
import HeroVideo from '@/components/sections/hero-video';

const LandingPage = () => {
  return (
    <main
      className="relative flex items-center justify-center min-h-screen p-4 sm:p-8"
      aria-label="Página principal de Skedy"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center max-w-7xl mx-auto">
        
        {/* Columna Izquierda: Contenido de Texto */}
        <HeroContent />

        {/* Columna Derecha: Video en Mockup de Celular */}
        <HeroVideo />
      </div>
    </main>
  )
}

export default LandingPage;
