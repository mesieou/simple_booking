'use client';

import { useEffect, useState } from 'react';
import { ButtonGrid } from '@components/ui/button-grid';

interface HorariosProps {
  providerId: string;
  date: Date;
  size: 'one' | 'few' | 'house';
  onTimeSelect?: (time: string) => void;
}

interface Horario {
  id: string;
  hora: string;
}

export default function Hour({ providerId, date, size, onTimeSelect }: HorariosProps) {
  const [horarios, setHorarios] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawSlots, setRawSlots] = useState<any>(null);

  useEffect(() => {
    const fetchHorarios = async () => {
      setLoading(true);
      try {
        if (!date || !providerId || !size) {
          setHorarios([]);
          setLoading(false);
          return;
        }
        const formattedDate = date.toISOString().split('T')[0];
        const res = await fetch(`/api/provider/${providerId}/slots?date=${formattedDate}`);
        if (!res.ok) throw new Error('Error al obtener los slots');
        const data = await res.json();
        const slots = data[0]?.slots || {};
        setRawSlots(slots);
        let horariosFiltrados: string[] = [];
        if (size === 'one') horariosFiltrados = slots['60'] || [];
        if (size === 'few') horariosFiltrados = slots['90'] || [];
        if (size === 'house') horariosFiltrados = slots['120'] || [];
        setHorarios(horariosFiltrados);
      } catch (error) {
        setHorarios([]);
      }
      setLoading(false);
    };
    fetchHorarios();
  }, [providerId, date, size]);

  if (loading) return <div className="p-2 text-gray-600 text-sm">Loading...</div>;

  if (horarios.length === 0) return <div className="p-2 text-sm text-red-600">No schedules available</div>;

  const buttonItems = horarios.map((hora, idx) => ({
    id: idx.toString(),
    label: hora,
    onClick: () => {
      if (onTimeSelect) {
        onTimeSelect(hora);
      }
    }
  }));

  return (
    <div className="bg-white shadow-md p-2 rounded-xl border">
      <ButtonGrid items={buttonItems} columns={2} gap={2} />
      {rawSlots && (
        <pre className="mt-4 bg-gray-100 text-xs p-2 rounded overflow-x-auto max-h-48">
          {JSON.stringify(rawSlots, null, 2)}
        </pre>
      )}
    </div>
  );
}
