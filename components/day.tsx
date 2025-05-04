'use client';

interface DayProps {
  date: Date;
  onSelect: (date: Date) => void;
  isSelected: boolean;
}

export default function Day({ date, onSelect, isSelected }: DayProps) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNumber = date.getDate();

  return (
    <button
      onClick={() => onSelect(date)}
      className="h-24 w-32 rounded-xl border text-center transition select-none group bg-muted text-white border-gray-200 enabled:cursor-pointer enabled:hover:bg-blue-100 enabled:hover:border-blue-600 enabled:hover:text-black disabled:opacity-30 disabled:pointer-events-none data-active:bg-blue-600 data-active:text-white data-active:border-blue-600"

    >
      <div className="space-y-1">
        <span className="text-xl text-label-4 group-data-active/button:text-white block leading-none group-enabled/button:text-white group-enabled/button:group-hover/button:text-gray-700">{dayName}</span>
        <span className="text-xl text-heading-4 group-data-active/button:text-white block font-medium leading-none group-enabled/button:text-white group-enabled/button:group-hover/button:text-black lg:leading-7">{dayNumber}</span>
      </div>
    </button>
  );
}
