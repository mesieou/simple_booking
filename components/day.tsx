// 'use client';

// import { useEffect, useState } from 'react';
// import { createClient } from '@/utils/supabase/client'; // Asegúrate que el path es correcto

// interface DayProps {
//   date: Date;
// }

// interface Horario {
//   id: string;
//   hora: string;
// }

// export default function Day({ date }: DayProps) {
//   const [horarios, setHorarios] = useState<Horario[]>([]);
//   const [showHorarios, setShowHorarios] = useState(false);
//   const supabase = createClient();

//   useEffect(() => {
//     const fetchHorarios = async () => {
//       const formattedDate = date.toISOString().split('T')[0];

//       const { data, error } = await supabase
//         .from('horarios')
//         .select('id, hora')
//         .eq('fecha', formattedDate)
//         .order('hora', { ascending: true });

//       if (error) {
//         console.error('❌ Error al obtener horarios:', error);
//         setHorarios([]);
//       } else {
//         setHorarios(data as Horario[]);
//       }
//     };

//     fetchHorarios();
//   }, [date]);

//   const toggleShowHorarios = () => setShowHorarios(!showHorarios);

//   const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
//   const dayNumber = date.getDate();

//   return (
//     <div className="relative">
//       <button
//         onClick={toggleShowHorarios}
//         className="h-32 w-36 rounded-xl bg-muted enabled:cursor-pointer disabled:opacity-[0.30] disabled:pointer-events-none select-none transition group/button border border-gray-200 enabled:hover:bg-white enabled:hover:border-theme-primary enabled:hover:text-white data-active:bg-theme-primary data-active:border-theme-primary text-center"
//       >
//         <div className="space-y-1">
//           <span className="text-xl font-medium">{dayName}</span>
//           <span className="text-2xl font-bold">{dayNumber}</span>
//           <div className="text-sm text-gray-600 mt-2">
//             {horarios.length > 0
//               ? `${horarios.length} horarios`
//               : 'Sin horarios'}
//           </div>
//         </div>
//       </button>

//       {showHorarios && (
//         <div className="mt-2 grid grid-cols-2 gap-2 p-2 bg-white shadow-lg rounded-xl border absolute z-10">
//           {horarios.map((h) => (
//             <button
//               key={h.id}
//               className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
//               onClick={() => alert(`Seleccionaste ${h.hora}`)}
//             >
//               {h.hora}
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

'use client';

interface DayProps {
  date: Date;
  onSelect: (date: Date) => void;
  isSelected: boolean;
}

export default function Day({ date, onSelect, isSelected }: DayProps) {
  const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' });
  const dayNumber = date.getDate();

  return (
    <button
      onClick={() => onSelect(date)}
      className={`h-32 w-36 rounded-xl border text-center transition 
        ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300 hover:bg-blue-100'}`}
    >
      <div className="space-y-1">
        <span className="text-xl font-medium capitalize">{dayName}</span>
        <span className="text-2xl font-bold">{dayNumber}</span>
      </div>
    </button>
  );
}

