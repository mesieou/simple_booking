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
    'Support',
    'Customer Service'
  ];

  return (
    <div className="text-center">





      <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-white mb-4 sm:mb-6 md:mb-8 leading-tight max-w-6xl mx-auto px-4">
        <span className="block mb-1 sm:mb-3">
          Your <span className="bg-primary text-white rounded-lg px-2 py-1 sm:px-3 sm:py-2 text-2xl sm:text-4xl md:text-5xl lg:text-7xl inline-block">AI receptionist</span>
        </span>
        <span className="block mb-1 sm:mb-3">
          handles your
        </span>
        <span className="text-white bg-secondary rounded-lg px-2 py-1 sm:px-3 sm:py-2 inline-block min-w-[200px] sm:min-w-[320px] text-2xl sm:text-4xl md:text-5xl lg:text-7xl">
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

      <p className="text-base sm:text-lg md:text-xl text-white/80 mb-6 sm:mb-8 md:mb-10 max-w-3xl mx-auto px-4 leading-relaxed font-normal">
       Never miss another customer. Skedy answers every call, books every appointment, and grows your business 24/7.
       </p>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto mb-8 sm:mb-12 md:mb-16 px-4">
        <div className="text-center bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-white/10">
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-400 mb-1 sm:mb-2">391%</div>
          <div className="text-xs sm:text-sm md:text-base text-white/80 font-medium leading-tight">Sales increase</div>
        </div>
        <div className="text-center bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-white/10">
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-400 mb-1 sm:mb-2">50%+</div>
          <div className="text-xs sm:text-sm md:text-base text-white/80 font-medium leading-tight">Cost reduction</div>
        </div>
        <div className="text-center bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-white/10">
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-400 mb-1 sm:mb-2">90%</div>
          <div className="text-xs sm:text-sm md:text-base text-white/80 font-medium leading-tight">Calls answered 24/7</div>
        </div>
        <div className="text-center bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-white/10">
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-fuchsia-400 mb-1 sm:mb-2">100%</div>
          <div className="text-xs sm:text-sm md:text-base text-white/80 font-medium leading-tight">Customer satisfaction</div>
        </div>
      </div>


    </div>
  );
};

export default HeroContent;
