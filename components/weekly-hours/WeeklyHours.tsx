"use client";

import React, { useEffect, useState } from 'react';
import DayAvailabilityRow from './DayAvailabilityRow';
import TimeZoneSelector from './TimeZoneSelector';
import { weeklyHoursData, WeeklyHoursData, DayAvailability, TimeRange } from './weeklyHoursData';

const STORAGE_KEY = 'weeklyHoursData';

const getInitialData = (): WeeklyHoursData => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Si hay error, usar datos por defecto
      }
    }
  }
  return weeklyHoursData;
};

const WeeklyHours: React.FC = () => {
  const [data, setData] = useState<WeeklyHoursData>(getInitialData());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const handleToggleAvailable = (dayIdx: number) => {
    setData(prev => {
      const days = [...prev.days];
      days[dayIdx] = {
        ...days[dayIdx],
        available: !days[dayIdx].available,
        ranges: !days[dayIdx].available ? [{ start: '09:00', end: '17:00' }] : [],
      };
      return { ...prev, days };
    });
  };

  const handleChangeRange = (dayIdx: number, rangeIdx: number, range: TimeRange) => {
    setData(prev => {
      const days = [...prev.days];
      const ranges = [...days[dayIdx].ranges];
      ranges[rangeIdx] = range;
      days[dayIdx] = { ...days[dayIdx], ranges };
      return { ...prev, days };
    });
  };

  const handleAddRange = (dayIdx: number) => {
    setData(prev => {
      const days = [...prev.days];
      const ranges = [...days[dayIdx].ranges, { start: '09:00', end: '17:00' }];
      days[dayIdx] = { ...days[dayIdx], ranges };
      return { ...prev, days };
    });
  };

  const handleRemoveRange = (dayIdx: number, rangeIdx: number) => {
    setData(prev => {
      const days = [...prev.days];
      const ranges = days[dayIdx].ranges.filter((_, i) => i !== rangeIdx);
      days[dayIdx] = { ...days[dayIdx], ranges };
      return { ...prev, days };
    });
  };

  const handleDuplicateRange = (dayIdx: number, rangeIdx: number) => {
    setData(prev => {
      const days = [...prev.days];
      const ranges = [...days[dayIdx].ranges];
      ranges.splice(rangeIdx + 1, 0, { ...ranges[rangeIdx] });
      days[dayIdx] = { ...days[dayIdx], ranges };
      return { ...prev, days };
    });
  };

  const handleChangeTimeZone = (tz: string) => {
    setData(prev => ({ ...prev, timeZone: tz }));
  };

  return (
    <section className="max-w-xl mx-auto p-6 rounded shadow mt-8" aria-label="Configuración de horarios semanales">
      <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
        <span className="material-icons">autorenew</span> Horarios semanales
      </h2>
      <p className="text-gray-600 mb-4">Configura cuándo estás disponible para reuniones.</p>
      <div className="divide-y">
        {data.days.map((day, idx) => (
          <DayAvailabilityRow
            key={day.day}
            day={day.day}
            available={day.available}
            ranges={day.ranges}
            onToggleAvailable={() => handleToggleAvailable(idx)}
            onChangeRange={(rangeIdx, range) => handleChangeRange(idx, rangeIdx, range)}
            onAddRange={() => handleAddRange(idx)}
            onRemoveRange={rangeIdx => handleRemoveRange(idx, rangeIdx)}
            onDuplicateRange={rangeIdx => handleDuplicateRange(idx, rangeIdx)}
          />
        ))}
      </div>
      <TimeZoneSelector value={data.timeZone} onChange={handleChangeTimeZone} />
    </section>
  );
};

export default WeeklyHours; 