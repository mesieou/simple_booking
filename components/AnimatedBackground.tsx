"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const AnimatedBackground = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Si no es cliente (JavaScript desactivado), mostrar fondo estático
  if (!isClient) {
    return (
      <div className="fixed inset-0 -z-10 w-full h-full overflow-hidden bg-gradient-to-br from-primary via-secondary to-background">
        {/* Elementos estáticos para cuando JavaScript está desactivado */}
        <div 
          className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full pointer-events-none"
          aria-hidden="true"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
        <div 
          className="absolute bottom-10 right-10 w-80 h-80 bg-white opacity-10 rounded-full pointer-events-none"
          aria-hidden="true"
        />
        <div 
          className="absolute top-1/3 right-1/4 w-40 h-40 bg-white opacity-10 rounded-full pointer-events-none"
          aria-hidden="true"
        />
      </div>
    );
  }

  // Si es cliente (JavaScript activado), mostrar fondo animado
  return (
    <div className="fixed inset-0 -z-10 w-full h-full overflow-hidden bg-gradient-to-br from-primary via-secondary to-background">
      <motion.div
        className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full pointer-events-none"
        aria-hidden="true"
        animate={{
          x: [0, 40, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
        style={{ translateX: "-50%", translateY: "-50%" }}
      />
      <motion.div
        className="absolute bottom-10 right-10 w-80 h-80 bg-white opacity-10 rounded-full pointer-events-none"
        aria-hidden="true"
        animate={{
          x: [0, -30, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/3 right-1/4 w-40 h-40 bg-white opacity-10 rounded-full pointer-events-none"
        aria-hidden="true"
        animate={{
          x: [0, 20, 0],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
      />
    </div>
  );
};

export default AnimatedBackground; 