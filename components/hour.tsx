'use client';

import { useEffect, useState } from 'react';
import { ButtonGrid } from '@/components/ui/button-grid';
import { createClient } from '@/lib/supabase/client';

interface HorariosProps {
  date: Date;
  onTimeSelect?: (time: string) => void;
}

interface Horario {
  id: string;
  hora: string;
}

export default function Hour({ date, onTimeSelect }: HorariosProps) {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchHorarios = async () => {
      setLoading(true);
      if (!date) return;
      const formattedDate = date.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('horarios')
        .select('id, hora')
        .eq('fecha', formattedDate)
        .order('hora', { ascending: true });

      if (error) {
        console.error('Error al obtener horarios:', error);
        setHorarios([]);
      } else {
        setHorarios(data as Horario[]);
      }

      setLoading(false);
    };

    fetchHorarios();
  }, [date]);

  if (loading) return <div className="p-2 text-gray-600 text-sm">Loading...</div>;

  if (horarios.length === 0) return <div className="p-2 text-sm text-red-600">No schedules available</div>;

  const buttonItems = horarios.map((h) => ({
    id: h.id,
    label: h.hora,
    onClick: () => {
      if (onTimeSelect) {
        onTimeSelect(h.hora);
      }
    }
  }));

  return (
    <div className="bg-white shadow-md p-2 rounded-xl border">
      <ButtonGrid items={buttonItems} columns={2} gap={2} />
    </div>
  );
}
