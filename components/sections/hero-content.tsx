"use client";

import { Typewriter } from 'react-simple-typewriter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Users, CheckCircle } from 'lucide-react';

const HeroContent = () => {
  const words = [
    'Bookings',
    'Calendars', 
    'Inquiries',
    'Payments',
    'Support'
  ];

  return (
    <div className="text-center">
      
      <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30 mb-6">
        <Play className="h-3 w-3 mr-1" />
        WhatsApp Business
      </Badge>
         
       
      
      <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
        Let 
        <span className="bg-primary text-white rounded-md mx-3">Chatbot</span>
        handle your
        <br />
        <span className="text-white bg-secondary rounded-md px-2 py-1 mt-4 inline-block">
          <Typewriter
            words={words}
            loop={0}
            cursor
            cursorStyle='|'
            typeSpeed={70}
            deleteSpeed={50}
            delaySpeed={1500}
          />
        </span>
      </h1>
      
      <p className="text-xl text-white/80 mb-8 max-w-3xl mx-auto">
       Your business never sleeps. 
       Each customer receives instant, personalized, and effective attention with Skedy's help.
       </p>
       <br />
       <br />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-12 p-4 rounded-lg">
        
        <div className="text-center">
            <div className="text-4xl font-bold text-green-400 mb-2">20%-67%</div>
            <div className="text-sm text-white">Sales increase</div>
          </div><div className="text-center">
          <div className="text-4xl font-bold text-red-400 mb-2">30%</div>
          <div className="text-sm text-white">Reduction in Costs</div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-purple-400 mb-2">80%</div>
          <div className="text-sm text-white">resolution without human intervention</div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-fuchsia-400 mb-2">57%</div>
          <div className="text-sm text-white">return investment</div>
        </div>
      </div>

       
    </div>
  );
};

export default HeroContent; 