import React from 'react';
import TimeRangeInput from './TimeRangeInput';
import { TimeRange } from './weeklyHoursData';

type DayAvailabilityRowProps = {
  day: string;
  available: boolean;
  ranges: TimeRange[];
  onToggleAvailable: () => void;
  onChangeRange: (index: number, range: TimeRange) => void;
  onAddRange: () => void;
  onRemoveRange: (index: number) => void;
  onDuplicateRange: (index: number) => void;
};

const DayAvailabilityRow: React.FC<DayAvailabilityRowProps> = ({
  day,
  available,
  ranges,
  onToggleAvailable,
  onChangeRange,
  onAddRange,
  onRemoveRange,
  onDuplicateRange,
}) => {
  return (
    <div className="flex items-center gap-4 py-2" aria-label={`Disponibilidad para ${day}`}>  
      <button
        type="button"
        onClick={onToggleAvailable}
        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${available ? 'bg-blue-600' : 'bg-gray-400'}`}
        aria-label={available ? `${day} disponible` : `${day} no disponible`}
        tabIndex={0}
      >
        {day[0]}
      </button>
      <span className="w-24 font-medium">{day}</span>
      {available ? (
        <div className="flex flex-col gap-1 flex-1">
          {ranges.map((range, idx) => (
            <TimeRangeInput
              key={idx}
              range={range}
              onChange={r => onChangeRange(idx, r)}
              index={idx}
            />
          ))}
          {ranges.length === 0 && (
            <button
              type="button"
              onClick={onAddRange}
              className="flex items-center text-blue-600 hover:text-blue-800 mt-1 focus:outline-none"
              aria-label="Agregar rango de horas"
              tabIndex={0}
            >
              <span className="text-xl mr-1">＋</span> Añadir rango
            </button>
          )}
        </div>
      ) : (
        <span className="text-gray-500 ml-2">No disponible</span>
      )}
    </div>
  );
};

export default DayAvailabilityRow; 