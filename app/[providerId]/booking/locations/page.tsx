'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Distance from '@components/form/locations/distance';
import ViewForm from '@/app/context/viewform';
import ProviderTitle from '@/app/context/ProviderTitle';
import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';
import { calcularPrecioDesdeApi, segundosAMinutos, formatearDuracion } from '@/lib/database/models/price';
import { fetchDirectGoogleMapsDistance } from '@/lib/general-helpers/google-distance-calculator';
export default function BookingDistanceStep({ params }: { params: Promise<{ providerId: string }> }) {
  const router = useRouter();
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener providerId del contexto
  const { setData, data } = useFormContext();
  const providerId = data.userid;

  const handleContinue = async () => {
    if (!origin || !destination) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Llamada real a la API
      const distanceData = await fetchDirectGoogleMapsDistance(origin, destination);

      if (distanceData && distanceData.status === 'OK' && distanceData.rows && distanceData.rows[0].elements && distanceData.rows[0].elements[0].status === "OK") {
        // 2. Extraer el elemento de duración
        const element = distanceData.rows[0].elements[0];

        // 3. Calcular el precio
        const price = calcularPrecioDesdeApi(element);
        const minutes = segundosAMinutos(element.duration.value);
        const readableDuration = formatearDuracion(element.duration.value);

        console.log("MINUTES:", minutes);
        console.log("READABLE DURATION:", readableDuration);
        console.log("THE PRICE IS: " + price);

        // 5. Guardar datos y continuar
        setData(prev => ({
          ...prev,
          pickup: origin,
          dropoff: destination,
          traveltimeestimate: readableDuration,
          traveltimeestimatenumber: minutes
        }));
        router.push(`/${providerId}/booking/products`);
      }
    } catch (err) {
      setError('An error occurred while calculating the distance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ProviderTitle providerId={providerId} />
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start justify-center p-4 md:p-12 max-w-7xl min-w-[320px] w-full mx-auto">
        {/* Columna izquierda: ViewForm */}
        <div className="w-full md:w-1/2 mb-8 md:mb-0 md:mr-8 flex flex-col items-center">
          <ViewForm />
        </div>
        {/* Columna derecha: Distance */}
        <div className="w-full min-w-[400px] max-w-xl md:w-1/2 bg-white rounded-xl shadow-md p-6 flex flex-col items-start">
          <h2 className="text-2xl font-bold mb-2 text-black">MOVES</h2>
          <p className="text-gray-400 mb-4">Enter your <span className="font-semibold">distance</span></p>
          <Distance 
            onChange={(origin, destination) => {
              setOrigin(origin);
              setDestination(destination);
            }}
            onContinue={handleContinue}
          />
          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}