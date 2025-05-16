'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Distance from '@/components/distance';
import BookingSummary from '@/components/BookingSummary';

export default function BookingDistanceStep() {
  const router = useRouter();
  const [origen, setOrigen] = useState<string>('');
  const [destino, setDestino] = useState<string>('');
  const [duracion, setDuracion] = useState<string | null>(null);

  const handleContinue = (duracion: string | null) => {
    setDuracion(duracion);
    router.push(`/booking/size?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}&duracion=${encodeURIComponent(duracion || '')}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start justify-center p-4 md:p-12 max-w-7xl min-w-[320px] w-full mx-auto">
      {/* Columna izquierda: BookingSummary */}
      <div className="w-full md:w-1/2 mb-8 md:mb-0 md:mr-8 flex flex-col items-center">
        <BookingSummary
          origen={origen}
          origenDireccion={origen}
          destino={destino}
          destinoDireccion={destino}
          vehiculo="--"
          luggers={0}
          precioBase={0}
          precioPorMinuto={0}
          arrivalWindow="--"
          moving={duracion || '--'}
        />
      </div>
      {/* Columna derecha: Distance */}
      <div className="w-full md:w-1/2 bg-white rounded-xl shadow-md p-6 flex flex-col items-start">
        <h2 className="text-2xl font-bold mb-2 text-black">MOVES</h2>
        <p className="text-gray-400 mb-4">Enter your <span className="font-semibold">distance</span></p>
        <Distance 
          onChange={(origen, destino) => {
            setOrigen(origen);
            setDestino(destino);
          }}
          onContinue={handleContinue}
        />
      </div>
    </div>
  );
}