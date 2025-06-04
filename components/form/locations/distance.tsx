'use client';

import React, { useState, useEffect } from 'react';
import Direction from '@components/form/locations/direction';
import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';
import { fetchDirectGoogleMapsDistance } from '@/lib/general-helpers/google-distance-calculator';
import { ciudadesPermitidas } from '@/lib/rename-categorise-better/utils/locations';
import { obtenerMensajeError } from '@/lib/rename-categorise-better/utils/locations';
import { validarUbicacion } from '@/lib/rename-categorise-better/utils/locations';

interface ErrorResult {
  error: string;
}

interface DistanceProps {
  onChange?: (origin: string, destination: string) => void;
  onContinue?: (duration: string | null) => void;
}

export default function Distance({ onChange, onContinue }: DistanceProps) {
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setData } = useFormContext();

  useEffect(() => {
    if (onChange) {
      onChange(origin, destination);
    }
  }, [origin, destination, onChange]);

  const handleContinue = async () => {
    if (!origin || !destination) {
      setError('Please enter both origin and destination');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDistance(null);
    setDuration(null);

    try {
      // Validate locations
      const originValid = await validarUbicacion(origin);
      if (!originValid) {
        setError(obtenerMensajeError(origin));
        return;
      }

      const destinationValid = await validarUbicacion(destination);
      if (!destinationValid) {
        setError(obtenerMensajeError(destination));
        return;
      }

      // Check that both addresses are in the same allowed city
      const originCity = ciudadesPermitidas.find(city => 
        origin.toLowerCase().includes(city.toLowerCase())
      );
      const destinationCity = ciudadesPermitidas.find(city => 
        destination.toLowerCase().includes(city.toLowerCase())
      );

      if (!originCity || !destinationCity) {
        setError('Both addresses must be in one of the following cities: ' + ciudadesPermitidas.join(', '));
        return;
      }

      if (originCity !== destinationCity) {
        setError('Origin and destination must be in the same city');
        return;
      }

      const distanceData = await fetchDirectGoogleMapsDistance(origin, destination);

      if (distanceData && distanceData.status === 'OK' && distanceData.rows && distanceData.rows[0].elements && distanceData.rows[0].elements[0].status === "OK") {
        const element = distanceData.rows[0].elements[0];
        setDistance(element.distance.text);
        // Use duration_in_traffic if available, otherwise use duration
        const estimatedTime = element.duration_in_traffic?.text || element.duration.text;
        setDuration(estimatedTime);
        // Update the global context with the data
        setData(prev => ({
          ...prev,
          pickup: origin,
          dropoff: destination,
          traveltimeestimete: estimatedTime,
        }));
        // Call onContinue with the duration
        onContinue && onContinue(estimatedTime);
      } else if (distanceData && distanceData.error_message) {
        setError(distanceData.error_message);
      } else if (distanceData && (distanceData.status !== 'OK' || distanceData.rows?.[0]?.elements?.[0]?.status !== 'OK')) {
        setError('Could not calculate the distance. API status: ' + distanceData.status + (distanceData.error_message ? ' - ' + distanceData.error_message : ''));
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
          label="Pick up from"
          id="origin"
          type="text"
          placeholder="Enter your origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        />

        <Direction
          label="Move to"
          id="destination"
          type="text"
          placeholder="Enter your destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />

        <div className="flex gap-4">
          <button
            onClick={handleContinue}
            disabled={isLoading || !origin || !destination}
            className="flex-1 px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {isLoading ? 'Calculating...' : 'Continue'}
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
