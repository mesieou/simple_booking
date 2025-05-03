// 'use client';

// import { useState } from 'react';
// import Day from '@/components/day';

// const getNextDays = (count: number): Date[] => {
//   const days: Date[] = [];
//   const today = new Date();
//   for (let i = 0; i < count; i++) {
//     const nextDay = new Date(today);
//     nextDay.setDate(today.getDate() + i);
//     days.push(nextDay);
//   }
//   return days;
// };

// export default function Calendar() {
//   const [showFullMonth, setShowFullMonth] = useState(false);
//   const daysToShow = showFullMonth ? 30 : 5;
//   const days = getNextDays(daysToShow);

//   return (
//     <div className="group space-y-3 transition-opacity [&:is(fieldset)]:disabled:opacity-25 text-center">
//       <label className="text-2xl text-label-2 font-medium leading-none text-white">
//         Select day
//       </label>
      
//       <div className="w-full grid grid-cols-5 gap-x-12 gap-y-5">
//         {days.map((day, index) => (
//           <Day key={index} date={day} />
//         ))}
//       </div>

//       <div className="pt-4">
//         <button
//           onClick={() => setShowFullMonth(!showFullMonth)}
//           className="h-max w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-2xl"
//         >
//           {showFullMonth ? 'Show Less' : 'Show Full Month'}
//         </button>
//       </div>
//     </div>
//   );
// }


'use client';

import { useState } from 'react';
import Day from '@/components/day';
import Horarios from '@/components/hour'; // importamos el nuevo componente

const getNextDays = (count: number): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + i);
    days.push(nextDay);
  }
  return days;
};

export default function Calendar() {
  const [showFullMonth, setShowFullMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const daysToShow = showFullMonth ? 30 : 5;
  const days = getNextDays(daysToShow);

  return (
    <div className="text-center space-y-6">
      <h2 className="text-2xl text-white">Selecciona un día</h2>

      <div className="grid grid-cols-5 gap-6">
        {days.map((day, index) => (
          <Day key={index} date={day} onSelect={setSelectedDate} isSelected={selectedDate?.toDateString() === day.toDateString()} />
        ))}
      </div>

      <div>
        <button
          onClick={() => setShowFullMonth(!showFullMonth)}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-lg"
        >
          {showFullMonth ? 'Mostrar menos' : 'Mostrar mes completo'}
        </button>
      </div>

      {selectedDate && (
        <div className="mt-8">
          <h3 className="text-xl text-white mb-4">Horarios disponibles para {selectedDate.toDateString()}</h3>
          <Horarios date={selectedDate} />
        </div>
      )}
    </div>
  );
}
