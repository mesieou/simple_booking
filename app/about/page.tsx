"use client"

import * as React from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { 
  Users, 
  Calendar, 
  MessageCircle, 
  Shield, 
  Zap, 
  Target,
  CheckCircle,
  Star,
  Award,
  TrendingUp
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function AboutPage() {
  const features = [
    {
      icon: Calendar,
      title: "Smart Booking System",
      description: "Automated appointment scheduling with intelligent time slot management",
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      icon: MessageCircle,
      title: "AI Chatbot Integration",
      description: "24/7 customer support with intelligent conversation handling",
      gradient: "from-green-500 to-emerald-600",
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Comprehensive role-based access control and team coordination",
      gradient: "from-purple-500 to-pink-600",
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with data protection and privacy",
      gradient: "from-orange-500 to-red-600",
    },
    {
      icon: Zap,
      title: "Dynamic Pricing",
      description: "Intelligent pricing strategies based on demand and availability",
      gradient: "from-yellow-500 to-orange-600",
    },
    {
      icon: Target,
      title: "Performance Analytics",
      description: "Real-time insights and data-driven decision making",
      gradient: "from-teal-500 to-cyan-600",
    },
  ]

  const values = [
    {
      title: "Innovation",
      description: "Constantly pushing boundaries with cutting-edge technology",
      icon: Zap,
    },
    {
      title: "Reliability",
      description: "Building trust through consistent, dependable service",
      icon: Shield,
    },
    {
      title: "Excellence",
      description: "Striving for perfection in every interaction and feature",
      icon: Award,
    },
    {
      title: "Growth",
      description: "Supporting your business expansion with scalable solutions",
      icon: TrendingUp,
    },
  ]

  return (
    <div className="min-h-screen relative">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge variant="secondary" className="mb-4 text-sm">
              About Skedy
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Revolutionizing Business
              <span className="text-primary"> Management</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed mb-8">
              We're transforming how businesses handle appointments, customer interactions, and team coordination with our innovative AI-powered platform.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8">
                Learn More
              </Button>
            </div>
          </motion.div>

          {/* Mission Section */}
          <motion.div 
            className="mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
                <Image 
                  src="/people.png" 
                  alt="Our Team at Skedy" 
                  width={600} 
                  height={450}
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-foreground">Our Mission</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  To empower businesses with intelligent automation tools that streamline operations, 
                  enhance customer experiences, and drive sustainable growth through innovative technology solutions.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-7 h-7 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">Streamline Operations</h4>
                      <p className="text-muted-foreground">Automate repetitive tasks and optimize workflows.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-7 h-7 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">Enhance Customer Experiences</h4>
                      <p className="text-muted-foreground">Deliver personalized and efficient service 24/7.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-7 h-7 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">Drive Sustainable Growth</h4>
                      <p className="text-muted-foreground">Provide data-driven insights for smarter decisions.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Features Section */}
          <motion.div 
            className="mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose Skedy?</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Discover the powerful features that make Skedy the ultimate business management solution
              </p>
            </div>
            
            <div className="space-y-10">
              {/* Row 1 */}
              <div className="flex flex-col md:flex-row justify-around items-stretch gap-8">
                {features.slice(0, 3).map((feature, index) => (
                  <React.Fragment key={index}>
                    <div className="flex items-center gap-5 text-left flex-1 max-w-sm mx-auto">
                      <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0`}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                        <p className="text-muted-foreground text-sm">{feature.description}</p>
                      </div>
                    </div>
                    {index < 2 && (
                      <Separator orientation="vertical" className="h-auto hidden md:block" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Row 2 */}
              <div className="flex flex-col md:flex-row justify-around items-stretch gap-8">
                {features.slice(3, 6).map((feature, index) => (
                  <React.Fragment key={index}>
                    <div className="flex items-center gap-5 text-left flex-1 max-w-sm mx-auto">
                      <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0`}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                        <p className="text-muted-foreground text-sm">{feature.description}</p>
                      </div>
                    </div>
                    {index < 2 && (
                      <Separator orientation="vertical" className="h-auto hidden md:block" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Values Section */}
          <motion.div 
            className="mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Our Values</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                The principles that guide everything we do
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 * index }}
                >
                  <Card className="text-center hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-6">
                      <value.icon className="w-8 h-8 mx-auto mb-4 text-primary" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                      <p className="text-sm text-muted-foreground">{value.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-12">
                <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Transform Your Business?</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Join thousands of businesses that have already revolutionized their operations with Skedy
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button size="lg" className="text-lg px-8">
                    Start Free Trial
                  </Button>
                  <Button variant="outline" size="lg" className="text-lg px-8">
                    Schedule Demo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
