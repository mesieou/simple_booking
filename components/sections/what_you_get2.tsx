import React from "react";
import { Card, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const icons = [
  {
    src: "/images/beneficts/24hours-removebg-preview.png",
    alt: "24/7 Support",
    label: "Get instant answers to your customers’ questions at any time, day or night.",
    aria: "24/7 Support",
  },
  {
    src: "/images/beneficts/language-removebg-preview.png",
    alt: "Any Language",
    label: "Communicate effortlessly with users in any language, breaking down global barriers.",
    aria: "Any Language",
  },
  {
    src: "/images/beneficts/whatsapp-removebg-preview.png",
    alt: "Personalized",
    label: "Enjoy a chatbot that continuously learns and adapts, becoming smarter with your feedback.",
    aria: "Personalized",
  },
  {
    src: "/images/beneficts/happy-removebg-preview.png",
    alt: "Happier Customers",
    label: "Delight your customers with fast, accurate, and friendly support every time.",
    aria: "Happier Customers",
  },
  {
    src: "/images/beneficts/scalable-removebg-preview.png",
    alt: "Scalable",
    label: "Effortlessly handle more conversations as your business grows, without extra cost.",
    aria: "Scalable",
  },
  {
    src: "/images/beneficts/customizable-removebg-preview.png",
    alt: "Reduce Costs",
    label: "Tailor the chatbot to your business needs in minutes and reduce operational expenses.",
    aria: "Reduce Costs",
  },
];

const WhatYouGet = () => {
  // Maneja el click y enter/espacio para accesibilidad
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, onClick: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <section className="flex flex-col items-center justify-center py-12 w-full">
      <div className="flex flex-col items-center justify-center mb-8">
        <h2 className="text-5xl md:text-8xl font-extrabold tracking-tight text-primary mb-2">
          UNIQUE
        </h2>
        <h2 className="text-3xl md:text-6xl font-bold tracking-tight text-white mb-2">
          For <span className="text-white">Your</span> <span className="text-white">Business</span>
        </h2>
        <div className="h-1 w-24 bg-primary rounded-full mt-2 transition-all duration-500" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl">
        {icons.map((icon) => (
          <Card
            key={icon.alt}
            tabIndex={0}
            aria-label={icon.aria}
            className="flex flex-col items-center justify-start p-6 shadow-lg transition-transform duration-300 hover:-translate-y-2 focus-visible:ring-2 focus-visible:ring-primary outline-none cursor-pointer min-h-[320px]"
            onClick={() => {}}
            onKeyDown={(e) => handleKeyDown(e, () => {})}
            >
            <img
              src={icon.src}
              alt={icon.alt}
              className="w-20 h-20 object-contain mb-4"
              aria-hidden="true"
            />
            <CardTitle className="text-lg font-semibold text-center mb-2">{icon.alt}</CardTitle>
            <CardDescription className="text-center text-base">{icon.label}</CardDescription>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default WhatYouGet;
