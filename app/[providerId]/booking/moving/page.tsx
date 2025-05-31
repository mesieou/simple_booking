'use client';

import { useRouter } from 'next/navigation';
import BookingSummary from '@/components/BookingSummary';
import React, { useState, useEffect } from 'react';
import ProviderTitle from '@/app/components/ProviderTitle';
import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';
import ViewForm from '@/app/components/viewform';

const SIZE_OPTIONS = [
  { key: 'one', label: 'One item', tarifa: 46, luggers: 1, vehiculo: 'Pickup' },
  { key: 'few', label: 'Few items', tarifa: 70, luggers: 2, vehiculo: 'Pickup' },
  { key: 'house', label: 'House', tarifa: 120, luggers: 3, vehiculo: 'Truck' },
];

export default function BookingMovingStep({ params }: { params: Promise<{ providerId: string }> }) {
  const router = useRouter();
  const { data, setData } = useFormContext();
  const [moving, setMoving] = useState('');
  const [providerId, setProviderId] = useState('');

  useEffect(() => {
    // Si no hay businessid en el contexto, lo obtenemos de params y lo guardamos en el contexto
    if (!data.businessid) {
      params.then(p => {
        setProviderId(p.providerId);
        setData(prev => ({ ...prev, businessid: p.providerId }));
      });
    } else {
      setProviderId(data.businessid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.businessid, params, setData]);

  // Buscar la opción de size seleccionada desde el contexto
  const selectedSize = SIZE_OPTIONS.find(opt => opt.key === data.size) || SIZE_OPTIONS[0];
  const traveled = 19;
  const labor_min = 213;
  const total = selectedSize.tarifa + traveled + labor_min;

  // Al continuar, guardar el dato en notes
  const handleContinue = () => {
    setData(prev => ({ ...prev, notes: moving }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ProviderTitle providerId={providerId} />
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start justify-center p-4 md:p-12 max-w-7xl min-w-[320px] w-full mx-auto">
        {/* Columna izquierda: Resumen y contexto */}
        <div className="w-full md:w-1/2 mb-8 md:mb-0 md:mr-8 flex flex-col items-center">
          <ViewForm />
        </div>
        {/* Columna derecha: Textarea */}
        <div className="w-full md:w-1/2 bg-white rounded-xl shadow-md p-6 flex flex-col items-start">
          <h2 className="text-2xl font-bold mb-4 text-black">Additional Information</h2>
          <textarea
            className="w-full min-h-[120px] max-h-60 border border-gray-300 rounded-lg p-3 text-lg mb-8 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 text-black"
            placeholder="Describe lo que necesitas mover..."
            value={moving}
            onChange={e => setMoving(e.target.value)}
            aria-label="Descripción de lo que vas a mover"
          />
          <div className="flex gap-4 self-end">
            <button
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg"
              onClick={() => router.back()}
              tabIndex={0}
              aria-label="Volver"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.back(); }}
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
              tabIndex={0}
              aria-label="Finalizar"
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && moving) handleContinue(); }}
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 