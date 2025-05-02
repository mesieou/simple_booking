'use client';

interface DayProps {
  date: Date;
}

export default function Day({ date }: DayProps) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }); // Ej: "lun"
  const dayNumber = date.getDate(); // Ej: 2

  return (
    <button className="h-32 w-36 rounded-xl bg-muted enabled:cursor-pointer disabled:opacity-[0.30] disabled:pointer-events-none select-none transition group/button border border-gray-200 enabled:hover:bg-white enabled:hover:border-theme-primary enabled:hover:text-white data-active:bg-theme-primary data-active:border-theme-primary">
      <div className="space-y-1">
        <span className="text-xl text-label-4 group-data-active/button:text-white block leading-none group-enabled/button:text-white group-enabled/button:group-hover/button:text-gray-700">
          {dayName}
        </span>
        <span className="text-xl text-heading-4 group-data-active/button:text-white block font-medium leading-none group-enabled/button:text-white group-enabled/button:group-hover/button:text-black lg:leading-7">
          {dayNumber}
        </span>
      </div>
    </button>
  );
}
