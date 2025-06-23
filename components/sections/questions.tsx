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
    question: "Is there a free trial available?",
    answer:
      "Yes, you can try us for free for 30 days. If you want, we'll provide you with a free, personalized 30-minute onboarding call to get you up and running as soon as possible.",
  },
  {
    question: "Can I change my plan later?",
    answer:
      "Of course. You can upgrade or downgrade your plan at any time. The changes will be prorated, so you only pay for what you use.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "You can cancel your subscription at any time. Your access will remain active until the end of the current billing period. We don't offer refunds for partial months.",
  },
  {
    question: "Can other info be added to an invoice?",
    answer:
      "Yes, you can customize your invoices with additional information such as your company's tax ID, address, or any other details required for your accounting.",
  },
  {
    question: "How does billing work?",
    answer:
      "We bill you automatically at the beginning of each billing cycle (monthly or annually). You can manage your payment methods from your account settings.",
  },
  {
    question: "How do I change my account email?",
    answer:
      "You can change the email address associated with your account from the 'Profile' section in your account settings. We will send a confirmation link to the new address.",
  },
]

export function Questions() {
  return (
    <section className="w-full py-12 md:py-24 max-w-2xl mx-auto">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Have questions? We have answers. If you can't find what you're looking for, feel free to contact us.
          </p>
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-lg text-left hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground pr-9">
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
