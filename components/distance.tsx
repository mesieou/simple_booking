'use client';

import React, { useState, useEffect } from 'react';
import Direction from '@/components/direction';
import { validarUbicacion, obtenerMensajeError, ciudadesPermitidas } from '@/utils/locations';
import { useFormContext } from '@/utils/FormContext';

interface ErrorResult {
  error: string;
}

interface DistanceProps {
  onChange?: (origen: string, destino: string) => void;
  onContinue?: (duracion: string | null) => void;
}

export default function Distance({ onChange, onContinue }: DistanceProps) {
  const [origen, setOrigen] = useState<string>('');
  const [destino, setDestino] = useState<string>('');
  const [distancia, setDistancia] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setData } = useFormContext();

  useEffect(() => {
    if (onChange) {
      onChange(origen, destino);
    }
  }, [origen, destino, onChange]);

  const handleContinue = async () => {
    if (!origen || !destino) {
      setError('Por favor, ingrese tanto el origen como el destino');
      return;
    }

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

      // Verificar que ambas direcciones estén en la misma ciudad permitida
      const origenCiudad = ciudadesPermitidas.find(ciudad => 
        origen.toLowerCase().includes(ciudad.toLowerCase())
      );
      const destinoCiudad = ciudadesPermitidas.find(ciudad => 
        destino.toLowerCase().includes(ciudad.toLowerCase())
      );

      if (!origenCiudad || !destinoCiudad) {
        setError('Ambas direcciones deben estar en una de las siguientes ciudades: ' + ciudadesPermitidas.join(', '));
        return;
      }

      if (origenCiudad !== destinoCiudad) {
        setError('El origen y el destino deben estar en la misma ciudad');
        return;
      }

      const response = await fetch(`/api/maps/mapsdistance?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`);
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
        // Actualizar el contexto global con los datos
        setData(prev => ({
          ...prev,
          pickup: origen,
          dropoff: destino,
          traveltimeestimete: tiempoEstimado,
        }));
        // Llamar a onContinue con la duración
        onContinue && onContinue(tiempoEstimado);
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
    <div className="p-4 w-full max-w-[600px] mx-auto">
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

        <div className="flex gap-4">
          <button
            onClick={handleContinue}
            disabled={isLoading || !origen || !destino}
            className="flex-1 px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {isLoading ? 'Calculando...' : 'Continuar'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-red-600">Error: {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
