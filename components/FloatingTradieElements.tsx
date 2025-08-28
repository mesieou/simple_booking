"use client";

import { useEffect, useState } from 'react';
import {
  Wrench,
  Hammer,
  Cog,
  Calendar,
  Clock,
  Phone,
  MessageSquare,
  DollarSign,
  CheckCircle,
  Settings,
  Truck,
  HardHat,
  Zap,
  Users,
  Star,
  Target
} from 'lucide-react';

interface FloatingElement {
  id: string;
  icon: React.ReactNode;
  x: number;
  y: number;
  size: number;
  rotation: number;
  delay: number;
  duration: number;
  color: string;
  bgColor: string;
}

const tradieIcons = [
  { icon: <Wrench />, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { icon: <Hammer />, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  { icon: <Cog />, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  { icon: <HardHat />, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  { icon: <Settings />, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  { icon: <Truck />, color: 'text-red-400', bgColor: 'bg-red-500/20' },
  { icon: <Calendar />, color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  { icon: <Clock />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  { icon: <Phone />, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  { icon: <MessageSquare />, color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  { icon: <DollarSign />, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  { icon: <CheckCircle />, color: 'text-lime-400', bgColor: 'bg-lime-500/20' },
  { icon: <Zap />, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  { icon: <Users />, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { icon: <Star />, color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  { icon: <Target />, color: 'text-red-400', bgColor: 'bg-red-500/20' },
];

const FloatingTradieElements = () => {
  const [elements, setElements] = useState<FloatingElement[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const generateElements = (): FloatingElement[] => {
      // Responsive element count based on screen size - minimal elements
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const elementCount = isMobile ? 3 : 5; // Very minimal floating elements
      const newElements: FloatingElement[] = [];

      for (let i = 0; i < elementCount; i++) {
        const iconData = tradieIcons[i % tradieIcons.length];

        // Position elements away from center content area
        const margin = isMobile ? 20 : 15; // Larger margin
        let x, y;

        // Keep elements in corners and edges, away from center
        if (Math.random() > 0.5) {
          // Left or right edges
          x = Math.random() > 0.5 ? margin : 100 - margin - 5;
          y = margin + Math.random() * (100 - 2 * margin);
        } else {
          // Top or bottom edges, avoiding center
          x = margin + Math.random() * (100 - 2 * margin);
          y = Math.random() > 0.5 ? margin : 100 - margin - 5;
        }

        newElements.push({
          id: `floating-${i}`,
          icon: iconData.icon,
          x: x,
          y: y,
          size: Math.random() * (isMobile ? 10 : 15) + (isMobile ? 25 : 35), // Even smaller icons
          rotation: Math.random() * 360,
          delay: Math.random() * 5, // Animation delay
          duration: Math.random() * 10 + 15, // Animation duration 15-25s
          color: iconData.color,
          bgColor: iconData.bgColor,
        });
      }

      return newElements;
    };

    setElements(generateElements());

    // Regenerate elements on resize
    const handleResize = () => {
      setElements(generateElements());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Background gradient overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

      {/* Enhanced floating text - positioned away from main content */}
      <div className="hidden lg:block absolute top-16 left-5 animate-float-slow opacity-40">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <span className="text-white font-medium text-xs">24/7 Available</span>
        </div>
      </div>

      <div className="hidden lg:block absolute bottom-10 right-5 animate-float-slow opacity-40">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <span className="text-white font-medium text-xs">391% More Sales</span>
        </div>
      </div>

      <div className="hidden lg:block absolute top-1/4 right-8 animate-float-slower opacity-40">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <span className="text-white font-medium text-xs">Scalable</span>
        </div>
      </div>

      <div className="hidden lg:block absolute bottom-1/4 left-8 animate-float-reverse opacity-40">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <span className="text-white font-medium text-xs">AI Powered</span>
        </div>
      </div>



    </div>
  );
};

export default FloatingTradieElements;
