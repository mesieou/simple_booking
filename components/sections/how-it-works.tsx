"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, Bot, Zap } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    step: "1",
    title: "Connect Your Calendar",
    description: "Link your existing calendars and booking systems in minutes with our seamless integration",
    icon: Calendar,
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  {
    step: "2", 
    title: "Train Your AI Agent",
    description: "Customize your AI agent to match your business needs, tone, and specific requirements",
    icon: Bot,
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  },
  {
    step: "3",
    title: "Watch It Work",
    description: "Your AI agent handles bookings, scheduling, and customer inquiries automatically 24/7",
    icon: Zap,
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { 
    opacity: 0, 
    y: 30,
    scale: 0.9
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

const stepVariants = {
  hidden: { 
    scale: 0,
    rotate: -180
  },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      duration: 0.5,
      ease: "backOut"
    }
  }
};

export default function HowItWorks() {
  return (
    <section className="py-20 bg-gradient-to-b relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="mx-auto max-w-7xl px-4 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-4 bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200 transition-colors">
            How It Works
          </Badge>
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white leading-tight">
            Simple Setup,{" "}
            <span className="bg-gradient-to-r from-primary to-white bg-clip-text text-transparent">
              Powerful Results
            </span>
          </h2>
          <p className="text-xl text-white max-w-3xl mx-auto">
            Get your AI-powered booking system up and running in minutes, not hours
          </p>
        </motion.div>

        {/* Steps Grid */}
        <motion.div 
          className="grid md:grid-cols-3 gap-8 lg:gap-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {steps.map((step, index) => (
            <motion.div 
              key={index} 
              className="relative group"
              variants={itemVariants}
            >
              {/* Step Card */}
              <div className={`text-center p-8 rounded-2xl border-2 ${step.borderColor} ${step.bgColor} hover:shadow-xl transition-all duration-300 group-hover:scale-105 group-hover:border-opacity-100`}>
                {/* Step Number */}
                <motion.div 
                  className={`w-20 h-20 bg-gradient-to-r ${step.color} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}
                  variants={stepVariants}
                >
                  <span className="text-2xl font-bold text-white">{step.step}</span>
                </motion.div>

                {/* Icon */}
                <div className="mb-6">
                  <step.icon className="w-12 h-12 mx-auto text-gray-600 group-hover:text-purple-600 transition-colors duration-300" />
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold mb-4 text-gray-900 group-hover:text-purple-600 transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>

                {/* Hover Effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Arrow Connector */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-6 transform -translate-y-1/2 z-10">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.2 }}
                  >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-purple-200">
                      <ArrowRight className="text-purple-500" size={20} />
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>


      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-purple-200 rounded-full opacity-20 blur-xl" />
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-blue-200 rounded-full opacity-20 blur-xl" />
    </section>
  );
} 