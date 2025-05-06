'use client';

import { Button } from "@/components/ui/button";

interface CalendarDayProps {
  date: Date;
  onSelect: (date: Date) => void;
  isSelected: boolean;
  className?: string;
}

export function CalendarDay({ date, onSelect, isSelected, className = '' }: CalendarDayProps) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNumber = date.getDate();
  
  // Validar si la fecha es pasada
  const isPastDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleClick = () => {
    if (!isPastDate()) {
      onSelect(date);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPastDate()}
      variant={isSelected ? "default" : "outline"}
      size="lg"
      className={`h-24 w-32 flex flex-col justify-center items-center border-2 border-white/50 hover:border-white ${className}`}
      aria-label={`${dayName}, ${dayNumber} ${isPastDate() ? '(Past date, not available)' : ''}`}
      aria-disabled={isPastDate()}
    >
      <span className="text-xl font-medium">{dayName}</span>
      <span className="text-2xl font-bold">{dayNumber}</span>
    </Button>
  );
} 