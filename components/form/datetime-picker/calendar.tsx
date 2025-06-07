'use client';

import { useState, useMemo } from 'react';
import { CalendarDay } from '@components/ui/calendar-day';
import Horarios from '@components/form/datetime-picker/hour';

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

interface CalendarProps {
  providerId: string;
  size: 'one' | 'few' | 'house';
  onSelect?: (date: Date, time?: string) => void;
}

export default function Calendar({ providerId, size, onSelect }: CalendarProps) {
  const [showFullMonth, setShowFullMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const daysToShow = showFullMonth ? 30 : 5;
  
  const days = useMemo(() => getNextDays(daysToShow), [daysToShow]);

  const handleDateSelect = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date >= today) {
      setSelectedDate(date);
      if (onSelect) onSelect(date);
    }
  };

  const handleTimeSelect = (time: string) => {
    if (selectedDate && onSelect) {
      onSelect(selectedDate, time);
    }
  };

  return (
    <div className="text-center space-y-6" role="region" aria-label="Appointment Calendar">
      

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

      {selectedDate && (
        <div className="mt-8" role="region" aria-label="Available schedules">
          <h3 className="text-xl text-white mb-4" id="horarios-title">
            Available schedules for {selectedDate.toDateString()}
          </h3>
          <Horarios 
            providerId={providerId}
            date={selectedDate} 
            size={size}
            onTimeSelect={handleTimeSelect}
            aria-labelledby="horarios-title" 
          />
        </div>
      )}
    </div>
  );
}