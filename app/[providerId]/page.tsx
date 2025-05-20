'use client';

import { useProvider } from '../context/ProviderContext';
import { useEffect, useState } from 'react';
import ProviderTitle from '../components/ProviderTitle';
import { use } from 'react';

export default function ProviderPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { setProviderId } = useProvider();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Desempaquetar la promesa de params
  const { providerId } = use(params);

  useEffect(() => {
    setProviderId(providerId);
  }, [providerId, setProviderId]);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/provider/${providerId}/slots?date=${date}`);
        if (!res.ok) throw new Error('Error al obtener los slots');
        const data = await res.json();
        setSlots(data);
      } catch (err: any) {
        setError(err.message || 'Error al obtener los slots');
      }
      setLoading(false);
    };
    if (providerId && date) fetchSlots();
  }, [providerId, date]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <ProviderTitle providerId={providerId} />
        <h1 className="text-2xl font-bold mb-4">
          Selecciona una opción de reserva
        </h1>
        {/* Input para seleccionar una fecha */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1" htmlFor="date">Fecha:</label>
          <input
            id="date"
            type="date"
            className="border rounded px-2 py-1"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        {/* Aquí puedes agregar los enlaces a las diferentes secciones de booking */}
        <div className="mt-6 text-stone-950">
          <h2 className="text-lg font-semibold mb-2">Slots disponibles (JSON):</h2>
          {loading && <div className="text-blue-500">Cargando...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {!loading && !error && (
            <pre className="bg-gray-100 text-xs p-3 rounded overflow-x-auto max-h-96">
              {JSON.stringify(slots, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
} 