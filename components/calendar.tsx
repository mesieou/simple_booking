// 'use client';

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
//   const days = getNextDays(30);

//   return (
//     <div className="group space-y-3 transition-opacity [&:is(fieldset)]:disabled:opacity-25">
//       <label className='text-label-2 after:text-label-5 group-data-optional:after:content-["optional"] font-medium leading-none after:ml-2 after:text-gray-400'>
//         Calendario
//       </label>
//       <div className='space-y-3'></div>
//       <div className="grid grid-cols-5 gap-3">
//         {days.map((day, index) => (
//           <Day key={index} date={day} />
//         ))}
//       </div>
//     </div>
//   );
// }
'use client';

import { useState } from 'react';
import Day from '@/components/day';

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
  const daysToShow = showFullMonth ? 30 : 5;
  const days = getNextDays(daysToShow);

  return (
    <div className="group space-y-3 transition-opacity [&:is(fieldset)]:disabled:opacity-25 text-center">
      <label className="text-2xl text-label-2 font-medium leading-none text-white">
        Select day
      </label>
      
      <div className="w-full grid grid-cols-5 gap-x-12 gap-y-5">
        {days.map((day, index) => (
          <Day key={index} date={day} />
        ))}
      </div>

      <div className="pt-4">
        <button
          onClick={() => setShowFullMonth(!showFullMonth)}
          className="h-max w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-2xl"
        >
          {showFullMonth ? 'Show Less' : 'Show Full Month'}
        </button>
      </div>
    </div>
  );
}
