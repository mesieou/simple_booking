"use client"

import Video from 'next-video';
import botDemo from '@/videos/bot-demo.mp4.json';
import { motion } from 'framer-motion';

const HeroVideo = () => {
  return (
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
  );
};

export default HeroVideo; 