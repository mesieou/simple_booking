import React, { useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Tipos para los pasos
export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  color: string; // tailwind color
  image: string;
  alt: string;
};

const steps: OnboardingStep[] = [
  {
    id: "more-bookings",
    title: "More bookings",
    description: "Increase bookings by 300% with AI automation that captures leads 24/7 and converts inquiries automatically.",
    color: "from-[#006BFF] to-[#7F56D9]",
    image:
      "https://images.ctfassets.net/k0lk9kiuza3o/4NxN65mDr8P3MkFqaaKE2W/39053e1843ca1e63b6ecf86b6bd50a02/connect-your-calendars.png?w=1300&q=85&fm=webp",
    alt: "More bookings",
  },
  {
    id: "less-costs",
    title: "Less costs",
    description: "Reduce operational costs by 70% by automating customer service and eliminating manual errors.",
    color: "from-[#8247F5] to-[#E55CFF]",
    image:
      "/images/beneficts_w/cost.webp",
    alt: "Less costs",
  },
  {
    id: "save-time",
    title: "Save time",
    description: "Save 40 hours per week by automating scheduling, reminders, payments, and customer support.",
    color: "from-[#E55CFF] to-[#FFA600]",
    image:
      "https://images.ctfassets.net/k0lk9kiuza3o/3puzS47NYyiqZoWFiycrH9/adec1f0b941e4f40e1b0503b96ed71d5/connect-conferencing-tools.png?w=1300&q=85&fm=webp",
    alt: "Save time",
  },
  {
    id: "ai-assistant",
    title: "24/7 AI WhatsApp Assistant",
    description: "Provide instant support 24/7 with AI that handles inquiries, bookings, and questions automatically.",
    color: "from-[#FFA600] to-[#14AA51]",
    image:
      "https://images.ctfassets.net/k0lk9kiuza3o/1tfXAIpnhfvJXzG7R9nqxc/0eb133b6908036371c44095751e03f88/customize-event-types.png?w=1300&q=85&fm=webp",
    alt: "24/7 AI WhatsApp Assistant",
  },
  {
    id: "multilanguage",
    title: "Multilanguage",
    description: "Reach global customers with AI that communicates fluently in multiple languages.",
    color: "from-[#14AA51] to-[#006BFF]",
    image:
      "/images/beneficts_w/multilanguage.png",
    alt: "Multilanguage",
  },
];

const OnboardingAccordion: React.FC = () => {
  const [openStep, setOpenStep] = useState<string>(steps[0].id);
  const currentIndex = steps.findIndex((s) => s.id === openStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="flex flex-col md:flex-row gap-12 w-full max-w-7xl mx-auto p-8">
      {/* Lado izquierdo: pasos y progreso */}
      <div className="w-full md:w-1/2 max-w-xl">
        <div className="mb-8">
          <Progress value={progress} className="h-3" />
        </div>
        <Accordion
          type="single"
          value={openStep}
          onValueChange={(val) => setOpenStep(val)}
          collapsible={false}
          className="space-y-4"
        >
          {steps.map((step, idx) => (
            <AccordionItem key={step.id} value={step.id}>
              <AccordionTrigger
                className={cn(
                  "rounded-2xl px-6 py-5 text-xl font-semibold transition bg-white/5 hover:bg-white/10 focus:outline-none flex items-center gap-4 border border-transparent",
                  openStep === step.id
                    ? "border-primary bg-white/10 shadow-xl"
                    : ""
                )}
                aria-label={step.title}
                tabIndex={0}
              >
                {step.title}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground text-lg pl-10 py-2">{step.description}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      {/* Lado derecho: imagen y contenido */}
      <div className="w-full md:w-1/2 flex items-center justify-center">
        <Card className="w-full max-w-2xl p-8 flex flex-col items-center bg-gradient-to-br from-white/80 to-white/60">
          <div className="w-full flex flex-col items-center">
            <img
              src={steps[currentIndex].image}
              alt={steps[currentIndex].alt}
              className="w-96 h-96 object-contain mb-8 rounded-3xl shadow-2xl"
              draggable={false}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingAccordion; 