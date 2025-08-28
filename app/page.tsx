"use client";

import { useState } from 'react';
import HeroContent from '@/components/sections/hero-content';
import Questions from '@/components/sections/questions';
import { Pricing } from '@/components/sections/pricing';
import { DemoSection } from '@/components/demo_section';
import { Button } from '@/components/ui/button';
import { Play, Users } from 'lucide-react';
import EmailDialog from '@/components/sections/email-dialog';

import FloatingTradieElements from '@/components/FloatingTradieElements';

const LandingPage = () => {
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const scrollToDemo = () => {
    const demoSection = document.getElementById('demo-section');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStartFree = () => {
    setIsEmailDialogOpen(true);
  };



  // Use correct business ID based on environment
  const getBusinessId = (): string => {
    if (process.env.NODE_ENV === 'production') {
      return '42f7bb6e-c4bb-4556-b33e-d2858612bd4c'; // Production business ID
    }
    return '495c1537-d2cb-4557-b498-25c44961e506'; // Development business ID
  };

  return (
    <>
      <main
        className="relative flex items-center justify-center min-h-screen px-2 sm:px-4 md:px-8 py-4 overflow-hidden pt-16 sm:pt-20"
        aria-label="Página principal de Skedy"
      >
        {/* Floating Tradie Elements Background */}
        <FloatingTradieElements />

        <div className="w-full max-w-6xl mx-auto text-center relative z-10">
          {/* Contenido Principal */}
          <div className="flex flex-col gap-6 md:gap-8">
            <HeroContent />

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary hover:from-purple-600 hover:to-pink-600 text-white px-6 sm:px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
                onClick={scrollToDemo}
              >
                <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Try Demo
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 px-6 sm:px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm text-sm sm:text-base"
                onClick={handleStartFree}
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Join the waitlist
              </Button>
            </div>
          </div>
        </div>
      </main>


      {/* Clean, Focused Sections */}
      <div id="demo-section">
        <DemoSection />
      </div>

      <div id="pricing-section">
        <Pricing />
      </div>
      <Questions />

      <EmailDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
      />
    </>

  )
}

export default LandingPage;
