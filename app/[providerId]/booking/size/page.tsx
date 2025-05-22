'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Precios from '@/components/precios';
import ViewForm from '@/app/components/viewform';
import React, { useState, use } from 'react';
import ProviderTitle from '@/app/components/ProviderTitle';
import { useFormContext } from '@/utils/FormContext';

const SIZE_OPTIONS = [
  { key: 'one', label: 'One item', tarifa: 46, luggers: 1, vehiculo: 'Pickup', icon: '/icons_size/one_item.png' },
  { key: 'few', label: 'Few items', tarifa: 70, luggers: 2, vehiculo: 'Pickup', icon: '/icons_size/few_items.png' },
  { key: 'house', label: 'House', tarifa: 120, luggers: 3, vehiculo: 'Truck', icon: '/icons_size/house.png' },
];

export default function BookingSizeStep({ params }: { params: Promise<{ providerId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { providerId } = use(params);
  const { setData } = useFormContext();

  // Obtener los datos de la URL
  const origen = searchParams.get('origen') || '--';
  const destino = searchParams.get('destino') || '--';
  const duracion = searchParams.get('duracion') || null;

  // Estado para el size seleccionado
  const [selectedSize, setSelectedSize] = useState(SIZE_OPTIONS[0]);

  // Precio por minuto de distancia
  const price_distance = 1.94;

  // Al continuar, navegar al calendario con los datos y el size
  const handleContinue = () => {
    setData(prev => ({
      ...prev,
      size: selectedSize.key,
    }));
    router.push(`/${providerId}/booking/calendar?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}&size=${selectedSize.key}&duracion=${encodeURIComponent(duracion || '')}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ProviderTitle providerId={providerId} />
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start justify-center p-4 md:p-12 max-w-7xl min-w-[320px] w-full mx-auto">
        {/* Columna izquierda: ViewForm */}
        <div className="w-full md:w-1/2 mb-8 md:mb-0 md:mr-8 flex flex-col items-center">
          <ViewForm />
        </div>
        {/* Columna derecha: Visual resumen y precios */}
        <div className="w-full md:w-1/2 bg-white rounded-xl shadow-md p-6 flex flex-col items-start">
          <h2 className="text-2xl font-bold mb-2 text-black">MOVES</h2>
          <p className="text-gray-400 mb-4">Select a <span className="font-semibold">size</span></p>
          <div className="flex gap-4 mb-6">
            {SIZE_OPTIONS.map(option => (
              <button
                key={option.key}
                className={`flex flex-col items-center border-2 rounded-xl px-6 py-4 transition-all duration-150 ${selectedSize.key === option.key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} hover:border-blue-400`}
                onClick={() => {
                  setSelectedSize(option);
                  setData(prev => ({
                    ...prev,
                    size: option.key,
                  }));
                }}
              >
                <img src={option.icon} alt={option.label} className="mb-2 w-16 h-16 object-contain" />
                <span className="mb-2 text-lg font-semibold text-black">{option.label}</span>
              </button>
            ))}
          </div>
          <Precios 
            base={selectedSize.tarifa} 
            labor_min={price_distance}
          />
          <div className="flex gap-4 self-end mt-8">
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
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              onClick={handleContinue}
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 