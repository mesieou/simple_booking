// 'use client';

// import { useEffect, useState } from 'react';
// import { createClient } from '@/utils/supabase/client'; // Asegúrate que el path es correcto

// type Horario = {
//   id: number;
//   fecha: string;
//   hora: string;
// };

// export default function Hour() {
//   const [horarios, setHorarios] = useState<Horario[]>([]);
//   const supabase = createClient();

//   useEffect(() => {
//     const fetchHorarios = async () => {
//       const today = new Date().toISOString().split('T')[0];
//       console.log('📆 Fecha de hoy:', today);

//       const { data, error } = await supabase
//         .from('horarios')
//         .select('*')
//         .eq('fecha', today)
//         .order('hora', { ascending: true });

//       if (error) {
//         console.error('❌ Error al consultar Supabase:', error);
//       } else {
//         console.log('✅ Horarios recibidos:', data);
//         setHorarios(data);
//       }
//     };

//     fetchHorarios();
//   }, [supabase]);

//   return (
//     <div className="grid grid-cols-2 gap-4">
//       {horarios.length === 0 ? (
//         <div className="text-gray-500">No hay horarios disponibles hoy</div>
//       ) : (
//         horarios.map((h) => (
//           <div
//             key={h.id}
//             className="h-32 w-36 rounded-xl bg-blue-500 text-white flex items-center justify-center"
//           >
//             <span className="text-2xl font-bold">{h.hora.slice(0, 5)}</span>
//           </div>
//         ))
//       )}
//     </div>
//   );
// }

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client'; // Asegúrate que el path es correcto

interface HorariosProps {
  date: Date;
}

interface Horario {
  id: string;
  hora: string;
}

export default function Hour({ date }: HorariosProps) {
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

  if (loading) return <div className="p-2 text-gray-600 text-sm">Cargando...</div>;

  if (horarios.length === 0) return <div className="p-2 text-sm text-red-600">Sin horarios</div>;

  return (
    <div className="grid grid-cols-2 gap-2 bg-white shadow-md p-2 rounded-xl border">
      {horarios.map((h) => (
        <button
          key={h.id}
          className="bg-blue-500 text-white text-sm px-2 py-1 rounded hover:bg-blue-600 transition"
          onClick={() => alert(`Elegiste ${h.hora}`)}
        >
          {h.hora}
        </button>
      ))}
    </div>
  );
}
