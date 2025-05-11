'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import BookingSummary from '@/components/BookingSummary';
import React, { useState } from 'react';

const SIZE_OPTIONS = [
  { key: 'one', label: 'One item', tarifa: 46, luggers: 1, vehiculo: 'Pickup' },
  { key: 'few', label: 'Few items', tarifa: 70, luggers: 2, vehiculo: 'Pickup' },
  { key: 'house', label: 'House', tarifa: 120, luggers: 3, vehiculo: 'Truck' },
];

export default function BookingMovingStep() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Obtener los datos de la URL
  const origen = searchParams.get('origen') || '--';
  const destino = searchParams.get('destino') || '--';
  const arrival = searchParams.get('arrival') || '--';
  const sizeKey = searchParams.get('size') || 'one';

  // Buscar la opción de size seleccionada
  const selectedSize = SIZE_OPTIONS.find(opt => opt.key === sizeKey) || SIZE_OPTIONS[0];
  const traveled = 19;
  const labor_min = 213;
  const total = selectedSize.tarifa + traveled + labor_min;

  // Estado para el textarea
  const [moving, setMoving] = useState('');

  // Al continuar, podrías guardar el dato o navegar al siguiente paso
  const handleContinue = () => {
    // Aquí podrías guardar o navegar
    alert('¡Reserva completada!\n' +
      `Origen: ${origen}\nDestino: ${destino}\nArrival: ${arrival}\nMoving: ${moving}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start justify-center p-4 md:p-12 max-w-7xl min-w-[320px] w-full mx-auto">
      {/* Columna izquierda: Resumen */}
      <div className="w-full md:w-1/2 mb-8 md:mb-0 md:mr-8 flex flex-col items-center">
        <BookingSummary
          origen={origen}
          origenDireccion={origen}
          destino={destino}
          destinoDireccion={destino}
          vehiculo={selectedSize.vehiculo}
          luggers={selectedSize.luggers}
          precioBase={total}
          precioPorMinuto={1.94}
          arrivalWindow={arrival}
          moving={moving || '--'}
        />
      </div>
      {/* Columna derecha: Textarea */}
      <div className="w-full md:w-1/2 bg-white rounded-xl shadow-md p-6 flex flex-col items-start">
        <h2 className="text-2xl font-bold mb-4 text-black">What are you moving?</h2>
        <textarea
          className="w-full min-h-[120px] max-h-60 border border-gray-300 rounded-lg p-3 text-lg mb-8 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Describe what you need to move..."
          value={moving}
          onChange={e => setMoving(e.target.value)}
        />
        <div className="flex gap-4 self-end">
          <button
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg"
            onClick={() => router.back()}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
            onClick={handleContinue}
            disabled={!moving}
          >
            Finalizar
          </button>
        </div>
      </div>
    </div>
  );
} 