'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

interface WorkingHours {
  start: string;
  end: string;
}

interface CalendarStepProps {
  data: {
    workingHours: {
      mon: WorkingHours | null;
      tue: WorkingHours | null;
      wed: WorkingHours | null;
      thu: WorkingHours | null;
      fri: WorkingHours | null;
      sat: WorkingHours | null;
      sun: WorkingHours | null;
    };
    bufferTime: number;
  };
  onUpdate: (data: any) => void;
}

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
] as const;

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const AMPM = ['am', 'pm'];

function parseTime(str: string) {
  // '09:00' => { hour: '09', minute: '00', ampm: 'am' }
  let [h, m] = str.split(':');
  let hour = String(Number(h) % 12 || 12).padStart(2, '0');
  let ampm = Number(h) < 12 ? 'am' : 'pm';
  return { hour, minute: m, ampm };
}
function to24Hour(hour: string, ampm: string) {
  let h = Number(hour);
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return String(h).padStart(2, '0');
}
function buildTime(hour: string, minute: string, ampm: string) {
  return `${to24Hour(hour, ampm)}:${minute}`;
}

export function CalendarStep({ data, onUpdate }: CalendarStepProps) {
  const [copyFromDay, setCopyFromDay] = useState<string>('');

  const handleDayToggle = (day: string, enabled: boolean) => {
    const newWorkingHours = { ...data.workingHours };
    if (enabled) {
      newWorkingHours[day as keyof typeof data.workingHours] = { start: '09:00', end: '17:00' };
    } else {
      newWorkingHours[day as keyof typeof data.workingHours] = null;
    }
    onUpdate({ workingHours: newWorkingHours });
  };

  const handleTimeChange = (day: string, field: 'start' | 'end', value: string) => {
    const newWorkingHours = { ...data.workingHours };
    const dayHours = newWorkingHours[day as keyof typeof data.workingHours];
    if (dayHours) {
      dayHours[field] = value;
      onUpdate({ workingHours: newWorkingHours });
    }
  };

  const handleCopyHours = () => {
    if (copyFromDay && data.workingHours[copyFromDay as keyof typeof data.workingHours]) {
      const sourceHours = data.workingHours[copyFromDay as keyof typeof data.workingHours];
      const newWorkingHours = { ...data.workingHours };
      
      DAYS.forEach(({ key }) => {
        if (key !== copyFromDay && newWorkingHours[key]) {
          newWorkingHours[key] = { ...sourceHours! };
        }
      });
      
      onUpdate({ workingHours: newWorkingHours });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Set your regular working hours. These times will be used to show available booking slots to your customers.
        </p>
      </div>

      {/* Working Hours */}
      <Card className="border border-primary/20 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Working Hours</CardTitle>
          <CardDescription className="text-gray-700">
            Toggle days on/off and set your operating hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS.map(({ key, label }) => {
            const dayHours = data.workingHours[key];
            const isEnabled = dayHours !== null;
            return (
              <div key={key} className="flex items-center gap-4">
                <div className="flex items-center gap-3 w-32">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleDayToggle(key, checked)}
                  />
                  <Label className="text-sm font-medium">{label}</Label>
                </div>
                {isEnabled && dayHours && (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={dayHours.start}
                      onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                      className="w-32 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="time"
                      value={dayHours.end}
                      onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                      className="w-32 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
                    />
                  </div>
                )}
                {!isEnabled && (
                  <div className="flex-1 text-sm text-gray-500">Closed</div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Buffer Time */}
      <Card className="border border-primary/20 rounded-xl mt-8">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Buffer Time
          </CardTitle>
          <CardDescription className="text-gray-700">
            Time needed between bookings for preparation or travel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              max="120"
              value={data.bufferTime}
              onChange={(e) => onUpdate({ bufferTime: parseInt(e.target.value) || 0 })}
              className="w-24 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
            />
            <span className="text-sm text-gray-600">minutes</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            This time will be automatically added between consecutive bookings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}