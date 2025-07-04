import HeroContent from '@/components/sections/hero-content';
import HeroVideo from '@/components/sections/hero-video';
import WaitlistForm from '@/components/sections/waitlist-form';
import ZeroFeesSection from '@/components/sections/ZeroFeesSection';
import Questions from '@/components/sections/questions';
import { Pricing } from '@/components/sections/pricing';
import HowItWorks from '@/components/sections/how-it-works';

const LandingPage = () => {
  return (
    <>
      <main
        className="relative flex items-center justify-center min-h-screen p-4 sm:p-8"
        aria-label="Página principal de Skedy"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center max-w-7xl mx-auto">
          {/* Columna Izquierda: Contenido de Texto + Formulario */}
          <div className="flex flex-col gap-8 mr-10">
            <HeroContent />
            <WaitlistForm />
          </div>
          {/* Columna Derecha: Video en Mockup de Celular */}
          <HeroVideo />
        </div>
      </main>
      <HowItWorks />
      <ZeroFeesSection />
      <Questions />
      <Pricing />
    </>
  )
}

export default LandingPage;
