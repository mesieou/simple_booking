'use client';

import { useEffect, useState } from 'react';
import { ButtonGrid } from '@components/ui/button-grid';

interface HourProps {
  providerId: string;
  date: Date;
  size: 'one' | 'few' | 'house';
  onTimeSelect?: (time: string) => void;
}

interface Slot {
  id: string;
  time: string;
}

export default function Hour({ providerId, date, size, onTimeSelect }: HourProps) {
  const [schedules, setSchedules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawSlots, setRawSlots] = useState<any>(null);

  useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true);
      try {
        if (!date || !providerId || !size) {
          setSchedules([]);
          setLoading(false);
          return;
        }
        const formattedDate = date.toISOString().split('T')[0];
        const res = await fetch(`/api/provider/${providerId}/slots?date=${formattedDate}`);
        if (!res.ok) throw new Error('Error fetching slots');
        const data = await res.json();
        const slots = data[0]?.slots || {};
        setRawSlots(slots);
        let filteredSchedules: string[] = [];
        if (size === 'one') filteredSchedules = slots['60'] || [];
        if (size === 'few') filteredSchedules = slots['90'] || [];
        if (size === 'house') filteredSchedules = slots['120'] || [];
        setSchedules(filteredSchedules);
      } catch (error) {
        setSchedules([]);
      }
      setLoading(false);
    };
    fetchSchedules();
  }, [providerId, date, size]);

  if (loading) return <div className="p-2 text-gray-600 text-sm">Loading...</div>;

  if (schedules.length === 0) return <div className="p-2 text-sm text-red-600">No schedules available</div>;

  const buttonItems = schedules.map((time, idx) => ({
    id: idx.toString(),
    label: time,
    onClick: () => {
      if (onTimeSelect) {
        onTimeSelect(time);
      }
    }
  }));

  return (
    <div className="bg-white shadow-md p-2 rounded-xl border">
      <ButtonGrid items={buttonItems} columns={2} gap={2} />
      {rawSlots && (
        <pre className="mt-4 bg-gray-100 text-xs p-2 rounded overflow-x-auto max-h-48">
          {JSON.stringify(rawSlots, null, 2)}
        </pre>
      )}
    </div>
  );
}
