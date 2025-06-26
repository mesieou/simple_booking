'use client';

import { useRouter } from 'next/navigation';
import Precios from '@components/form/products/products';
import ViewForm from '@/app/context/viewform';
import React, { useState } from 'react';
import ProviderTitle from '@/app/context/ProviderTitle';
import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';
import { type ServiceData } from '@/lib/database/models/service';
import { computeQuoteEstimationFromData } from '@/lib/general-helpers/quote-cost-calculator';

type ProductsViewProps = {
  initialServices: ServiceData[];
  providerId: string;
};

export default function ProductsView({ initialServices, providerId }: ProductsViewProps) {
  const router = useRouter();
  const { setData, data } = useFormContext();
  
  const [sizeOptions] = useState<ServiceData[]>(initialServices);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const selectedServiceData = sizeOptions.find(opt => opt.id === selectedSize);
  const travelTimeEstimate = Number(data.traveltimeestimatenumber) || 0;

  let quote = null;
  if (selectedServiceData) {
    // We need a modified quote calculator that works with raw data instead of a class instance.
    quote = computeQuoteEstimationFromData(
      selectedServiceData,
      travelTimeEstimate
    );
  }

  const handleContinue = () => {
    if (!selectedServiceData || !quote) return;
    setData(prev => ({
      ...prev,
      size: selectedServiceData.id || '',
      serviceid: selectedServiceData.id || '',
      selectedService: selectedServiceData, // Pass the raw data object
      travelcostestimate: quote.travelCost?.toString() || '',
      totalJobCostEstimation: quote.totalJobCost?.toString() || '',
    }));
    router.push(`/${providerId}/booking/datetime-picker`);
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
          <p className="text-gray-400 mb-4">Select a <span className="font-semibold">service</span></p>
          <div className="flex gap-4 mb-6 flex-wrap">
            {sizeOptions.map(option => (
              <button
                key={option.id}
                className={`flex flex-col items-center border-2 rounded-xl px-6 py-4 transition-all duration-150 ${selectedSize === option.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} hover:border-blue-400`}
                onClick={() => {
                  setSelectedSize(option.id || '');
                  setData(prev => ({
                    ...prev,
                    size: option.id || '',
                    serviceid: option.id || '',
                    selectedService: option,
                  }));
                }}
              >
                <span className="mb-2 text-lg font-semibold text-black">{option.name}</span>
              </button>
            ))}
          </div>
          <Precios 
            base={quote?.totalJobCost || 0}
            labor_min={quote?.serviceCost || 0}
          />
          <div>
            <p className='text-black'>totalJobCost: {quote?.totalJobCost}</p>
            <p className='text-black'>serviceCost: {quote?.serviceCost}</p>
            <p className='text-black'>travelCost: {quote?.travelCost}</p>
            <p className='text-black'>totalJobDuration: {quote?.totalJobDuration}</p>
            <p className='text-black'>travelTime: {quote?.travelTime}</p>
          </div>
          <div className="flex gap-4 self-end mt-8">
            <button
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg"
              onClick={() => router.back()}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              onClick={handleContinue}
              disabled={!selectedSize}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 