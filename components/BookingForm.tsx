'use client';

import React, { useState } from 'react';
import Distance from './distance';
import Calendar from './calendar';
import { validarUbicacion } from '@/utils/locations';

interface BookingFormData {
  origen: string;
  destino: string;
  fecha: Date | null;
  hora: string | null;
  distancia: string | null;
  duracion: string | null;
}

export default function BookingForm() {
  const [formData, setFormData] = useState<BookingFormData>({
    origen: '',
    destino: '',
    fecha: null,
    hora: null,
    distancia: null,
    duracion: null
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validar ubicaciones
      const origenValido = await validarUbicacion(formData.origen);
      const destinoValido = await validarUbicacion(formData.destino);

      if (!origenValido || !destinoValido) {
        setError('Por favor, verifica las ubicaciones ingresadas');
        return;
      }

      if (!formData.fecha || !formData.hora) {
        setError('Por favor, selecciona una fecha y hora');
        return;
      }

      // Aquí iría la lógica para guardar la reserva
      console.log('Datos del formulario:', formData);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Reserva tu servicio</h2>
          
          {/* Sección de Distancia */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Ubicaciones</h3>
            <Distance />
          </div>

          {/* Sección de Calendario */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Fecha y Hora</h3>
            <Calendar />
          </div>

          {/* Botón de envío */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Procesando...' : 'Confirmar Reserva'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </form>
    </div>
  );
} 