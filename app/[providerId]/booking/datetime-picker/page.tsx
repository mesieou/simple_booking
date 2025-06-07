'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Calendar from '@components/form/datetime-picker/calendar';
import React, { useState } from 'react';
import ProviderTitle from '@/app/context/ProviderTitle';
import ViewForm from '@/app/context/viewform';
import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';

export default function BookingCalendarStep({ params }: { params: Promise<{ providerId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { providerId } = React.use(params);
  const { data, setData } = useFormContext();

  // Get the data from the URL
  const origin = searchParams.get('origin') || '--';
  const destination = searchParams.get('destination') || '--';
  const sizeKey = searchParams.get('size') || 'one';

  const SIZE_OPTIONS = [
    { key: 'one', label: 'One item', tarifa: 46, luggers: 1, vehiculo: 'Pickup' },
    { key: 'few', label: 'Few items', tarifa: 70, luggers: 2, vehiculo: 'Pickup' },
    { key: 'house', label: 'House', tarifa: 120, luggers: 3, vehiculo: 'Truck' },
  ];

  // Find the selected size option
  const selectedSize = SIZE_OPTIONS.find(opt => opt.key === sizeKey) || SIZE_OPTIONS[0];
  const traveled = 19;
  const labor_min = 213;
  const total = selectedSize.tarifa + traveled + labor_min;

  // State to save the selected date/time
  const [arrival, setArrival] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Function to handle date/time selection from the calendar
  const handleCalendarSelect = (date: Date, time?: string) => {
    setSelectedDate(date);
    setSelectedTime(time || '');
    const dateStr = date.toLocaleDateString();
    const timeStr = time ? ` ${time}` : '';
    setArrival(`${dateStr}${timeStr}`);
  };

  // On continue, navigate to the next step with the data
  const handleContinue = () => {
    setData(prev => ({ ...prev, arrivaldate: arrival }));
    router.push(`/${providerId}/booking/moving?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&arrival=${encodeURIComponent(arrival)}&size=${encodeURIComponent(sizeKey)}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ProviderTitle providerId={providerId} />
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start justify-center p-4 md:p-12 max-w-7xl min-w-[320px] w-full mx-auto">
        {/* Columna izquierda: ViewForm */}
        <div className="w-full md:w-1/2 mb-8 md:mb-0 md:mr-8 flex flex-col items-center">
          <ViewForm />
        </div>
        {/* Columna derecha: Calendario */}
        <div className="w-full md:w-1/2 bg-white rounded-xl shadow-md p-6 flex flex-col items-start">
          <h2 className="text-2xl font-bold mb-2 text-black">Arrival time</h2>
          <p className="text-base text-gray-500 mb-6">Choose a time you'd like us to arrive at your pickup location.</p>
          <div className="w-full mb-8">
            <Calendar 
              providerId={providerId}
              size={sizeKey as 'one' | 'few' | 'house'}
              onSelect={handleCalendarSelect} 
            />
          </div>
          <div className="flex gap-4 self-end">
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              onClick={handleContinue}
              disabled={!arrival}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 