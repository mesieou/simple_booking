"use client"

import Video from 'next-video';
import botDemo from '@/videos/bot-demo.mp4.json';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const LandingPage = () => {
  return (
    <main
      className="relative flex items-center justify-center min-h-screen p-4 sm:p-8"
      aria-label="Página principal de Skedy"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center max-w-7xl mx-auto">
        
        {/* Columna Izquierda: Contenido de Texto */}
        <motion.div 
          className="text-center lg:text-left"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-relaxed mb-6">
            We help mobile business to manage their{" "}
            <span className="text-foreground bg-primary/80 px-1 rounded-sm">
              bookings
            </span>{" "}
            and{" "}
            <span className="text-secondary bg-white px-1 rounded-sm">
              calendars
            </span>{" "}
            with AI agents
          </h1>

          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0">
            Your top source for business automation. Discover how our AI can streamline your operations and delight your customers.
          </p>

          <button
            className="group px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex items-center justify-center mx-auto lg:mx-0 gap-2"
            tabIndex={0}
            aria-label="Empezar ahora"
          >
            Get started now
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Columna Derecha: Video en Mockup de Celular */}
        <motion.div 
          className="relative w-full flex justify-center lg:justify-start"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeInOut" }}
        >
          <div className="relative w-[320px] h-[640px] transform lg:rotate-6 transition-transform duration-500 hover:rotate-3 hover:scale-105">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-blue-500 rounded-[50px] blur-2xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
            
            {/* Phone Mockup */}
            <div className="relative w-full h-full bg-slate-900 rounded-[40px] border-[10px] border-slate-800 shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 border-2 border-slate-800 rounded-b-xl z-20"></div>
              <div className="w-full h-full bg-black rounded-[30px] overflow-hidden">
                <Video 
                  src={botDemo} 
                  autoPlay 
                  muted 
                  loop 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}

export default LandingPage;
