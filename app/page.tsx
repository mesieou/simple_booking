"use client";

import { useState } from 'react';
import HeroContent from '@/components/sections/hero-content';
import WaitlistForm from '@/components/sections/waitlist-form';
import ZeroFeesSection from '@/components/sections/ZeroFeesSection';
import Questions from '@/components/sections/questions';
import { Pricing } from '@/components/sections/pricing';
import HowItWorks from '@/components/sections/how-it-works';
import { DemoSection } from '@/components/demo_section';
import { Button } from '@/components/ui/button';
import { Play, Users } from 'lucide-react';
import WhatYouGet from '@/components/sections/what_you_get';
import EmailDialog from '@/components/sections/email-dialog';
import Team from '@/components/sections/team';
import AnimatedRibbons from '@/components/animated ribbon/AnimatedRibbons';
import { FeaturesSection as WhatYouGet3 } from '@/components/sections/what_you_get3';
import WhatYouGet2 from '@/components/sections/what_you_get2';
import { CTASection } from '@/components/sections/cta-section';
import OnboardingAccordion from '@/components/ui/OnboardingAccordion';
import OnboardingAccordion2 from '@/components/ui/OnboardingAccordion2';

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

  const handleCTAClick = () => {
    setIsEmailDialogOpen(true);
  };

  return (
    <>
      <main
        className="relative flex items-center justify-center min-h-screen p-4 sm:p-8"
        aria-label="Página principal de Skedy"
      >
        <div className="max-w-4xl mx-auto text-center">
          {/* Contenido Principal */}
          <div className="flex flex-col gap-8">
            <HeroContent />
            
            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-secondary hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3"
                onClick={scrollToDemo}
              >
                <Play className="h-5 w-5 mr-2" />
                Try Demo
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="border-white/20 text-white hover:bg-white/10 px-8 py-3"
                onClick={handleStartFree}
              >
                <Users className="h-5 w-5 mr-2" />
                Start free
              </Button>
            </div>
          </div>
        </div>
      </main>

      
      <div id="demo-section">
        <DemoSection />
      </div>
      <div className="my-16">
        <OnboardingAccordion />
      </div>
      <div className="my-16">
        <OnboardingAccordion2 />
      </div>
      
      
      <WhatYouGet3 />
      <Questions />
      <Pricing />
      
      <EmailDialog 
        isOpen={isEmailDialogOpen} 
        onClose={() => setIsEmailDialogOpen(false)} 
      />
      <CTASection onButtonClick={handleCTAClick} />
    </>
    
  )
}

export default LandingPage;
