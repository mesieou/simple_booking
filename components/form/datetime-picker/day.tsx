'use client';

import { useState, useMemo } from 'react';
import { CalendarDay } from '@components/ui/calendar-day';
import Horarios from '@components/form/datetime-picker/hour';
import { useProvider } from '@/app/context/ProviderContext';

const getNextDays = (count: number): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize current date to midnight

  for (let i = 0; i < count; i++) {
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + i);
    days.push(nextDay);
  }
  return days;
};

const SIZES = [
  { value: 'one', label: 'One item' },
  { value: 'few', label: 'Few items' },
  { value: 'house', label: 'Full move' }
] as const;

type SizeType = typeof SIZES[number]['value'];

export default function Calendar() {
  const [showFullMonth, setShowFullMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [size, setSize] = useState<SizeType>('one');
  const { providerId } = useProvider();

  const daysToShow = showFullMonth ? 30 : 5;
  const days = useMemo(() => getNextDays(daysToShow), [daysToShow]);

  const handleDateSelect = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date >= today) {
      setSelectedDate(date);
    }
  };

  return (
    <div className="text-center space-y-6" role="region" aria-label="Appointment Calendar">
      <h2 className="text-2xl text-white" id="calendar-title">Select a day</h2>

      <div 
        className="grid grid-cols-5 gap-6"
        role="grid"
        aria-labelledby="calendar-title"
      >
        {days.map((day, index) => (
          <CalendarDay 
            key={index} 
            date={day} 
            onSelect={handleDateSelect} 
            isSelected={selectedDate?.toDateString() === day.toDateString()} 
          />
        ))}
      </div>

      <div>
        <button
          onClick={() => setShowFullMonth(!showFullMonth)}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-lg"
          aria-expanded={showFullMonth}
          aria-controls="calendar-grid"
          aria-label={showFullMonth ? 'Show fewer days' : 'Show full month'}
        >
          {showFullMonth ? 'Show less' : 'Show full month'}
        </button>
      </div>

      {/* Service size selector */}
      <div className="flex justify-center gap-4 mt-4">
        <label htmlFor="size-select" className="text-white">Service type:</label>
        <select
          id="size-select"
          className="border rounded px-2 py-1"
          value={size}
          onChange={e => setSize(e.target.value as SizeType)}
          aria-label="Select service type"
        >
          {SIZES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {selectedDate && providerId && (
        <div className="mt-8" role="region" aria-label="Available schedules">
          <h3 className="text-xl text-white mb-4" id="horarios-title">
            Available schedules for {selectedDate.toDateString()}
          </h3>
          <Horarios
            date={selectedDate}
            providerId={providerId}
            size={size}
            aria-labelledby="horarios-title"
          />
        </div>
      )}
      {selectedDate && !providerId && (
        <div className="mt-8 text-red-500">Select a provider to see available schedules.</div>
      )}
    </div>
  );
}