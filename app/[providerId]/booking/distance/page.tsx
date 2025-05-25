'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Distance from '@/components/distance';
import ViewForm from '@/app/components/viewform';
import ProviderTitle from '@/app/components/ProviderTitle';
import { useFormContext } from '@/utils/FormContext';
import { calcularPrecioDesdeApi, segundosAMinutos, formatearDuracion } from '@/lib/models/price';

export default function BookingDistanceStep({ params }: { params: Promise<{ providerId: string }> }) {
  const router = useRouter();
  const [origen, setOrigen] = useState<string>('');
  const [destino, setDestino] = useState<string>('');
  const [duracion, setDuracion] = useState<string | null>(null);

  // Obtener providerId del contexto
  const { setData, data } = useFormContext();
  const providerId = data.userid;

  const handleContinue = async () => {
    if (!origen || !destino) return;

    // 1. Llamada real a la API
    const res = await fetch(`/api/maps/mapsdistance?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`);

    if (!res.ok) {
      const text = await res.text();
      console.error('Respuesta no OK:', text);
      alert('Error al obtener la distancia. Intenta de nuevo.');
      return;
    }

    let dataApi;
    try {
      dataApi = await res.json();
    } catch (e) {
      const text = await res.text();
      console.error('No se pudo parsear JSON:', text);
      alert('Respuesta inválida de la API de distancia.');
      return;
    }

    // 2. Extraer el elemento de duración
    const element = dataApi.rows[0].elements[0];

    if (element.status && element.status !== 'OK') {
      alert('No se pudo calcular la distancia.');
      return;
    }

    // 3. Calcular el precio
    const precio = calcularPrecioDesdeApi(element);
    const minutos = segundosAMinutos(element.duration.value);
    const duracionLegible = formatearDuracion(element.duration.value);

    console.log("MINUTOS:", minutos);
    console.log("DURACIÓN LEIBLE:", duracionLegible);
    console.log("EL PRECIO ES: " + precio);

    // 5. Guardar datos y continuar
    setData(prev => ({
      ...prev,
      pickup: origen,
      dropoff: destino,
      traveltimeestimate: element.duration.value // en segundos
    }));
    router.push(`/${providerId}/booking/size`);
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
            onChange={(origen, destino) => {
              setOrigen(origen);
              setDestino(destino);
            }}
            onContinue={handleContinue}
          />
        </div>
      </div>
    </div>
  );
}