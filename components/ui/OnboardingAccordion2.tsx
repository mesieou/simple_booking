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
    id: "faq",
    title: "Frequently Asked Questions",
    description: "Find quick answers to your customers' most common questions and improve their support experience.",
    color: "from-[#006BFF] to-[#7F56D9]",
    image:
    "/images/beneficts_w/available days.png",
    alt: "Frequent questions",
  },
  {
    id: "quotes",
    title: "Calculate quotes",
    description: "Allow your customers to instantly calculate quotes, speeding up their decision and purchase process.",
    color: "from-[#8247F5] to-[#E55CFF]",
    image:
      "https://images.ctfassets.net/k0lk9kiuza3o/3uhXLeNh7p33JzpuSffAEF/009eef428d442a902b9f22453bcc1e04/add-your-availability.png?w=1300&q=85&fm=webp",
    alt: "Calculate quotes",
  },
  {
    id: "easy-scheduling",
    title: "Easy scheduling",
    description: "Make it easy for users to book appointments or services with a fast and intuitive system.",
    color: "from-[#E55CFF] to-[#FFA600]",
    image:
      "/images/beneficts_w/booking.webp",
    alt: "Easy scheduling",
  },
  {
    id: "automation",
    title: "Booking Automation",
    description: "Automate booking management and reminders to reduce manual work and avoid errors.",
    color: "from-[#FFA600] to-[#14AA51]",
    image:
      "https://images.ctfassets.net/k0lk9kiuza3o/1tfXAIpnhfvJXzG7R9nqxc/0eb133b6908036371c44095751e03f88/customize-event-types.png?w=1300&q=85&fm=webp",
    alt: "Booking Automation",
  },
  {
    id: "payments",
    title: "Payment integration",
    description: "Integrate online payments easily and securely so your customers can pay when booking.",
    color: "from-[#14AA51] to-[#006BFF]",
    image:
      "https://images.ctfassets.net/k0lk9kiuza3o/1khRzWDpK0OmjtQF04v8CM/fc02b6f92d161b1fd54f8d6ca3bd29ac/share-scheduling-link.png?w=1300&q=85&fm=webp",
    alt: "Payment integration",
  },
];

const OnboardingAccordion: React.FC = () => {
  const [openStep, setOpenStep] = useState<string>(steps[0].id);
  const currentIndex = steps.findIndex((s) => s.id === openStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="flex flex-col md:flex-row gap-12 w-full max-w-7xl mx-auto p-8">
      {/* Lado izquierdo: imagen */}
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
      {/* Lado derecho: pasos y progreso */}
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
    </div>
  );
};

export default OnboardingAccordion; 