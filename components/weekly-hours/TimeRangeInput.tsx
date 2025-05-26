import React from 'react';

type TimeRange = {
  start: string;
  end: string;
};

type TimeRangeInputProps = {
  range: TimeRange;
  onChange: (range: TimeRange) => void;
  index: number;
};

const TimeRangeInput: React.FC<TimeRangeInputProps> = ({ range, onChange, index }) => {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...range, start: e.target.value });
  };
  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...range, end: e.target.value });
  };

  return (
    <div className="flex items-center gap-2 mb-2" aria-label={`Rango de horas ${index + 1}`}>  
      <input
        type="time"
        value={range.start}
        onChange={handleStartChange}
        className="border rounded px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-600"
        aria-label="Hora de inicio"
        tabIndex={0}
      />
      <span className="mx-1">–</span>
      <input
        type="time"
        value={range.end}
        onChange={handleEndChange}
        className="border rounded px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-600"
        aria-label="Hora de fin"
        tabIndex={0}
      />
    </div>
  );
};

export default TimeRangeInput; 