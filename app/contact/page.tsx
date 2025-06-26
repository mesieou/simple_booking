"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { Mail, MessageCircle, Facebook, Instagram } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type FormData = {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  service: string
  message: string
}

export default function ContactPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<FormData>()

  const [showSuccess, setShowSuccess] = React.useState(false)

  const handleFormSubmit = async (data: FormData) => {
    try {
      // Simulate form submission
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log("Form data:", data)
      
      // Show success message
      setShowSuccess(true)
      
      // Reset form
      reset()
      
      // Hide message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000)
    } catch (error) {
      console.error("Error submitting form:", error)
    }
  }

  const contactMethods = [
    {
      icon: Mail,
      title: "Email",
      value: "info@skedy.io",
      href: "mailto:info@skedy.io",
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp",
      value: "+91 98260 00000",
      href: "https://wa.me/91982600000",
      gradient: "from-green-400 to-green-600",
    },
    {
      icon: Facebook,
      title: "Facebook",
      value: "@skedy.io",
      href: "https://facebook.com/yourcompany",
      gradient: "from-blue-600 to-blue-700",
    },
    {
      icon: Instagram,
      title: "Instagram",
      value: "@skedy.io",
      href: "https://www.instagram.com/skedy.io_/",
      gradient: "from-pink-500 to-purple-600",
    },
  ]

  return (
    <div className="min-h-screen relative">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Contact Us
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Have a question? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Contact information */}
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-4">Let's Talk</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  We're here to help you transform your business with our innovative solutions. 
                  Don't hesitate to contact us through any of these channels.
                </p>
              </div>

              <div className="space-y-6">
                {contactMethods.map((method, index) => (
                  <Card key={index} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${method.gradient} flex items-center justify-center flex-shrink-0`}>
                          <method.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-1">{method.title}</h3>
                          {method.href !== "#" ? (
                            <a 
                              href={method.href} 
                              className="text-foreground hover:text-primary/80 transition-colors"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {method.value}
                            </a>
                          ) : (
                            <p className="text-muted-foreground whitespace-pre-line">{method.value}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Contact form */}
            <Card>
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold">Send us a message</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {showSuccess && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white flex items-center gap-3">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Message sent successfully! We'll contact you soon.</span>
                  </div>
                )}

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="text-sm font-medium">
                        First Name *
                      </label>
                      <Input
                        id="firstName"
                        {...register("firstName", { required: "First name is required" })}
                        placeholder="Your first name"
                      />
                      {errors.firstName && (
                        <p className="text-destructive text-sm">{errors.firstName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="lastName" className="text-sm font-medium">
                        Last Name *
                      </label>
                      <Input
                        id="lastName"
                        {...register("lastName", { required: "Last name is required" })}
                        placeholder="Your last name"
                      />
                      {errors.lastName && (
                        <p className="text-destructive text-sm">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        Email *
                      </label>
                      <Input
                        id="email"
                        type="email"
                        {...register("email", { 
                          required: "Email is required",
                          pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                            message: "Please enter a valid email"
                          }
                        })}
                        placeholder="your@email.com"
                      />
                      {errors.email && (
                        <p className="text-destructive text-sm">{errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium">
                        Phone
                      </label>
                      <Input
                        id="phone"
                        type="tel"
                        {...register("phone")}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="company" className="text-sm font-medium">
                      Company
                    </label>
                    <Input
                      id="company"
                      {...register("company")}
                      placeholder="Your company name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="service" className="text-sm font-medium">
                      Service of Interest
                    </label>
                    <Select onValueChange={(value) => setValue("service", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp-ai">WhatsApp AI Agent</SelectItem>
                        <SelectItem value="dynamic-pricing">Dynamic Pricing</SelectItem>
                        <SelectItem value="calendar-management">Calendar Management</SelectItem>
                        <SelectItem value="team-management">Team Management</SelectItem>
                        <SelectItem value="custom-solution">Custom Solution</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">
                      Message *
                    </label>
                    <Textarea
                      id="message"
                      {...register("message", { required: "Message is required" })}
                      className="min-h-[120px] resize-vertical"
                      placeholder="Tell us about your project or question..."
                    />
                    {errors.message && (
                      <p className="text-destructive text-sm">{errors.message.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 text-lg"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Sending...
                      </div>
                    ) : (
                      "Send Message"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}