"use client"

import * as React from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "How does the AI receptionist work?",
    answer: "Your AI receptionist answers calls 24/7, handles bookings, and provides customer support with natural conversation."
  },
  {
    question: "Can it handle complex customer requests?",
    answer: "Yes, our AI understands context and can manage detailed inquiries, bookings, and customer service interactions."
  },
  {
    question: "What languages are supported?",
    answer: "The AI receptionist supports multiple languages and automatically detects the caller's preferred language."
  },
  {
    question: "How quickly can I get started?",
    answer: "Setup takes just minutes. Simply connect your phone number and customize your AI receptionist's responses."
  },
  {
    question: "Is there a call limit?",
    answer: "No call limits. Your AI receptionist can handle unlimited conversations simultaneously."
  },
  {
    question: "Can I customize the responses?",
    answer: "Yes, easily customize your AI's personality, responses, and business-specific information through our simple interface."
  }
];

export function Questions() {
  return (
    <section className="w-full py-8 sm:py-12 md:py-20 max-w-2xl mx-auto">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-3 sm:mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Have questions? We have answers. If you can't find what you're looking for, feel free to contact us.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-base sm:text-lg text-left hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-muted-foreground pr-6 sm:pr-9">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

export default Questions;
