'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Distance from '@/components/distance';
import BookingSummary from '@/components/BookingSummary';

export default function BookingDistanceStep() {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const router = useRouter();

  // Función para manejar el cambio en Distance
  const handleDistanceChange = (origenValue: string, destinoValue: string) => {
    setOrigen(origenValue);
    setDestino(destinoValue);
  };

  // Al continuar, navegar a la página de selección de size
  const handleContinue = () => {
    router.push(`/booking/size?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start justify-center p-4 md:p-12 max-w-7xl min-w-[320px] w-full mx-auto">
      {/* Columna izquierda: Resumen */}
      <div className="w-full md:w-1/2 mb-8 md:mb-0 md:mr-8 flex flex-col items-center">
        <BookingSummary
          origen={origen || '--'}
          origenDireccion={origen || '--'}
          destino={destino || '--'}
          destinoDireccion={destino || '--'}
          vehiculo="--"
          luggers={0}
          precioBase={0}
          precioPorMinuto={0}
          arrivalWindow="--"
          moving="--"
        />
      </div>
      {/* Columna derecha: Paso 1 */}
      <div className="w-full md:w-1/2 bg-white rounded-xl shadow-md p-6 flex flex-col items-start min-w-[500px]">
        <h2 className="text-2xl font-bold mb-2 text-black">Pickup & drop-off</h2>
        <p className="text-base text-gray-500 mb-6">Enter your pickup and drop-off addresses</p>
        <div className="w-full mb-8">
          <Distance onChange={handleDistanceChange} />
        </div>
        <button
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg self-end"
          onClick={handleContinue}
          disabled={!origen || !destino}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}