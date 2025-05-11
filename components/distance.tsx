'use client';

import React, { useState, useEffect } from 'react';
import Direction from '@/components/direction';
import { validarUbicacion, obtenerMensajeError } from '@/utils/locations';

interface ErrorResult {
  error: string;
}

interface DistanceProps {
  onChange?: (origen: string, destino: string) => void;
}

export default function Distance({ onChange }: DistanceProps) {
  const [origen, setOrigen] = useState<string>('');
  const [destino, setDestino] = useState<string>('');
  const [distancia, setDistancia] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (onChange) {
      onChange(origen, destino);
    }
  }, [origen, destino, onChange]);

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
    <div className="p-4 min-w-[400px] w-full max-w-[600px] mx-auto">
      <div className="space-y-4">
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
          className="w-full mt-4 px-4 py-2 rounded bg-brand text-white disabled:opacity-50"
        >
          {isLoading ? 'Calculando...' : 'Calcular Distancia'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-red-600">Error: {error}</p>
          </div>
        )}

        {distancia && duracion && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-800">Distancia entre {origen} y {destino}:</h3>
            <div className="mt-2 space-y-1">
              <p className="text-gray-600">Distancia: {distancia}</p>
              <p className="text-gray-600">Tiempo estimado: {duracion}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
