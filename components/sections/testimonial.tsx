"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const testimonials = [
  {
    name: "Gustave",
    quote:
      "A quality product. The mobile application and its many features have simplified and improved our work.",
    image: "/testimonial_1.webp", // Replace with actual image paths
  },
  {
    name: "John Doe",
    quote: "This is the best tool I have ever used. Highly recommended!",
    image: "/testimonial_1.webp",
  },
  {
    name: "Jane Smith",
    quote: "Incredible user experience and fantastic customer support.",
    image: "/testimonial_1.webp",
  },
];

export function Testimonials() {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCurrent(api.selectedScrollSnap());

    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on("select", handleSelect);

    return () => {
      api.off("select", handleSelect);
    };
  }, [api]);

  return (
    <div className="relative flex items-center justify-center w-full h-1/2 text-foreground overflow-hidden">
      <div className="flex items-center justify-center w-full h-full max-w-7xl mx-auto">
        <div className="absolute left-8 top-1/2 -translate-y-1/2 transform -rotate-90 text-sm uppercase tracking-widest text-muted-foreground">
          Testimonials
        </div>

        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {testimonials.map((testimonial, index) => (
              <CarouselItem key={index}>
                <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-16 p-8">
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={500}
                      height={300}
                      className="rounded-lg object-cover"
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="relative"
                  >
                    <h3 className="text-4xl font-light mb-8">{testimonial.name}</h3>
                    <Card className="bg-gray-900/40 dark:bg-black/40 text-white p-8 backdrop-blur-sm border-0 relative">
                      <p className="text-xl leading-relaxed">
                        {testimonial.quote}
                      </p>
                    </Card>
                  </motion.div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-12 z-10">
            <CarouselPrevious className="relative static translate-y-0 w-16 h-16 bg-primary/80 hover:bg-primary text-white">
              <ChevronLeft className="w-8 h-8"/>
            </CarouselPrevious>
            <CarouselNext className="relative static translate-y-0 w-16 h-16 bg-primary/80 hover:bg-primary text-white">
              <ChevronRight className="w-8 h-8"/>
            </CarouselNext>
          </div>
        </Carousel>

        <div className="absolute bottom-8 left-8 flex items-end gap-2 text-foreground">
          <span className="text-8xl font-light leading-none">
            {String(current + 1).padStart(2, "0")}
          </span>
          <span className="text-2xl font-light text-muted-foreground pb-2">
            / {String(testimonials.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
