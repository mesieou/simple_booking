'use client';

import React, { useState } from 'react';
import Direction from '@/components/direction';
import { validarUbicacion, obtenerMensajeError } from '@/utils/locations';

interface ErrorResult {
  error: string;
}

export default function Distance() {
  const [origen, setOrigen] = useState<string>('');
  const [destino, setDestino] = useState<string>('');
  const [distancia, setDistancia] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleClickCalcular = async () => {
    setIsLoading(true);
    setError(null);
    setDistancia(null);
    setDuracion(null);

    try {
      // Validar ubicaciones
      const origenValido = await validarUbicacion(origen);
      if (!origenValido) {
        setError(obtenerMensajeError(origen));
        return;
      }

      const destinoValido = await validarUbicacion(destino);
      if (!destinoValido) {
        setError(obtenerMensajeError(destino));
        return;
      }

      const response = await fetch(`/api/maps?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`);
      const responseText = await response.text();
      console.log('Respuesta del servidor:', responseText);

      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Error del servidor: ${responseText}`);
        }
      }

      const data = JSON.parse(responseText);
      const element = data.rows?.[0]?.elements?.[0];
      if (element?.status === 'OK') {
        setDistancia(element.distance.text);
        // Usar duration_in_traffic si está disponible, sino usar duration
        const tiempoEstimado = element.duration_in_traffic?.text || element.duration.text;
        setDuracion(tiempoEstimado);
      } else if (data.error) {
        setError(data.error);
      } else {
        setError('No se pudo calcular la distancia.');
      }
    } catch (err: any) {
      console.error('Error:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Calculador de Distancia</h2>

      <Direction
        texto="Pick up from"
        id="origen"
        type="text"
        placeholder="Introduce your origin"
        value={origen}
        onChange={(e) => setOrigen(e.target.value)}
      />

      <Direction
        texto="Move to"
        id="destino"
        type="text"
        placeholder="Introduce ypur Destine"
        value={destino}
        onChange={(e) => setDestino(e.target.value)}
      />

      <button
        onClick={handleClickCalcular}
        disabled={isLoading}
        className="mt-4 px-4 py-2 rounded bg-brand text-white disabled:opacity-50"
      >
        {isLoading ? 'Calculando...' : 'Calcular Distancia'}
      </button>

      {error && <p className="mt-4 text-red-600">Error: {error}</p>}

      {distancia && duracion && (
        <div className="mt-4">
          <h3 className="font-medium">Distancia entre {origen} y {destino}:</h3>
          <p>Distancia: {distancia}</p>
          <p>Tiempo estimado: {duracion}</p>
        </div>
      )}
    </div>
  );
}
