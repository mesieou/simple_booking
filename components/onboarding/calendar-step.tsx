'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Copy, User } from 'lucide-react';
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

interface ProviderCalendarSetting {
  providerIndex: number;
  providerName: string;
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
}

interface CalendarStepProps {
  data: {
    providerCalendarSettings: ProviderCalendarSetting[];
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
  const [copyFromProvider, setCopyFromProvider] = useState<number>(-1);

  const handleDayToggle = (providerIndex: number, day: string, enabled: boolean) => {
    const newSettings = [...data.providerCalendarSettings];
    const provider = newSettings[providerIndex];
    
    if (enabled) {
      provider.workingHours[day as keyof typeof provider.workingHours] = { start: '09:00', end: '17:00' };
    } else {
      provider.workingHours[day as keyof typeof provider.workingHours] = null;
    }
    
    onUpdate({ providerCalendarSettings: newSettings });
  };

  const handleTimeChange = (providerIndex: number, day: string, field: 'start' | 'end', value: string) => {
    const newSettings = [...data.providerCalendarSettings];
    const provider = newSettings[providerIndex];
    const dayHours = provider.workingHours[day as keyof typeof provider.workingHours];
    
    if (dayHours) {
      dayHours[field] = value;
      onUpdate({ providerCalendarSettings: newSettings });
    }
  };

  const handleBufferTimeChange = (providerIndex: number, bufferTime: number) => {
    const newSettings = [...data.providerCalendarSettings];
    newSettings[providerIndex].bufferTime = bufferTime;
    onUpdate({ providerCalendarSettings: newSettings });
  };

  const handleCopyFromProvider = (targetProviderIndex: number) => {
    if (copyFromProvider >= 0 && copyFromProvider !== targetProviderIndex) {
      const newSettings = [...data.providerCalendarSettings];
      const sourceProvider = newSettings[copyFromProvider];
      const targetProvider = newSettings[targetProviderIndex];
      
      // Copy working hours and buffer time
      targetProvider.workingHours = JSON.parse(JSON.stringify(sourceProvider.workingHours));
      targetProvider.bufferTime = sourceProvider.bufferTime;
      
      onUpdate({ providerCalendarSettings: newSettings });
      setCopyFromProvider(-1); // Reset selection
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Set individual working hours and settings for each provider. These times will be used to show available booking slots to your customers.
        </p>
        {data.providerCalendarSettings.length > 1 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-800">💡 Tip:</p>
            <p className="text-sm text-blue-700">You can copy settings from one provider to another using the "Copy Settings" buttons below.</p>
          </div>
        )}
      </div>

      {/* Provider Calendar Settings */}
      {data.providerCalendarSettings.map((provider, providerIndex) => (
        <Card key={providerIndex} className="border border-primary/20 rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {provider.providerName}
                  </CardTitle>
                  <CardDescription className="text-gray-700">
                    Individual calendar settings and working hours
                  </CardDescription>
                </div>
              </div>
              {data.providerCalendarSettings.length > 1 && (
                <div className="flex items-center gap-2">
                  {copyFromProvider >= 0 && copyFromProvider !== providerIndex && (
                    <Button
                      onClick={() => handleCopyFromProvider(providerIndex)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Paste Here
                    </Button>
                  )}
                  <Button
                    onClick={() => setCopyFromProvider(providerIndex)}
                    variant={copyFromProvider === providerIndex ? "default" : "outline"}
                    size="sm"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    {copyFromProvider === providerIndex ? "Selected" : "Copy Settings"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Working Hours */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Working Hours</h4>
                <div className="space-y-3">
                  {DAYS.map(({ key, label }) => {
                    const dayHours = provider.workingHours[key];
                    const isEnabled = dayHours !== null;
                    return (
                      <div key={key} className="flex items-center gap-4">
                        <div className="flex items-center gap-3 w-32">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleDayToggle(providerIndex, key, checked)}
                          />
                          <Label className="text-sm font-medium">{label}</Label>
                        </div>
                        {isEnabled && dayHours && (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="time"
                              value={dayHours.start}
                              onChange={(e) => handleTimeChange(providerIndex, key, 'start', e.target.value)}
                              className="w-32 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
                            />
                            <span className="text-gray-500">to</span>
                            <Input
                              type="time"
                              value={dayHours.end}
                              onChange={(e) => handleTimeChange(providerIndex, key, 'end', e.target.value)}
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
                </div>
              </div>

              {/* Buffer Time */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Buffer Time
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Time needed between bookings for preparation or travel
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    value={provider.bufferTime}
                    onChange={(e) => handleBufferTimeChange(providerIndex, parseInt(e.target.value) || 0)}
                    className="w-24 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  This time will be automatically added between consecutive bookings for this provider.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}