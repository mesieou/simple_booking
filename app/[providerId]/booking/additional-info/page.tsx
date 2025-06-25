'use client';

import { useRouter } from 'next/navigation';
import BookingSummary from '@components/sections/BookingSummary';
import React, { useState, useEffect, use } from 'react';
import ProviderTitle from '@/app/context/ProviderTitle';
import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';
import ViewForm from '@/app/context/viewform';
import { saveQuoteToSupabase } from '@/lib/rename-categorise-better/utils/saveQuote';

const SIZE_OPTIONS = [
  { key: 'one', label: 'One item', tarifa: 46, luggers: 1, vehiculo: 'Pickup' },
  { key: 'few', label: 'Few items', tarifa: 70, luggers: 2, vehiculo: 'Pickup' },
  { key: 'house', label: 'House', tarifa: 120, luggers: 3, vehiculo: 'Truck' },
];

export default function BookingMovingStep(props: { params: Promise<{ providerId: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const { data, setData } = useFormContext();
  const [moving, setMoving] = useState('');
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    // If there is no businessid in the context, get it from params and save it in the context
    if (!data.businessid) {
      setProviderId(params.providerId);
      setData(prev => ({ ...prev, businessid: params.providerId }));
    } else {
      setProviderId(data.businessid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.businessid, params, setData]);

  // Find the selected size option from the context
  const selectedSize = SIZE_OPTIONS.find(opt => opt.key === data.size) || SIZE_OPTIONS[0];
  const traveled = 19;
  const labor_min = 213;
  const total = selectedSize.tarifa + traveled + labor_min;

  // On continue, save the data in notes
  const handleContinue = async () => {
    setData(prev => ({ ...prev, notes: moving }));
    setLoading(true);
    setFeedback(null);
    const result = await saveQuoteToSupabase({ ...data, notes: moving });
    setLoading(false);
    if (result.success) {
      setFeedback('Quote saved successfully!');
      // Here you can redirect or clear the form if you want
    } else {
      setFeedback('Error saving: ' + result.error);
    }
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
            placeholder="Describe what you need to move..."
            value={moving}
            onChange={e => setMoving(e.target.value)}
            aria-label="Description of what you are going to move"
          />
          <div className="flex gap-4 self-end">
            <button
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg"
              onClick={() => router.back()}
              tabIndex={0}
              aria-label="Back"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.back(); }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              onClick={handleContinue}
              disabled={!moving || loading}
              tabIndex={0}
              aria-label="Finish"
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && moving && !loading) handleContinue(); }}
            >
              {loading ? 'Saving...' : 'Finish'}
            </button>
          </div>
          {feedback && (
            <div className={`mt-4 text-lg ${feedback.startsWith('Quote') ? 'text-green-600' : 'text-red-600'}`}>{feedback}</div>
          )}
        </div>
      </div>
    </div>
  );
} 