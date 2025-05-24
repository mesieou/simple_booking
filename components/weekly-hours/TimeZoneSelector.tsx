import React from 'react';

const timeZones = [
  { value: 'America/New_York', label: 'Eastern Time - US & Canada' },
  { value: 'America/Chicago', label: 'Central Time - US & Canada' },
  { value: 'America/Denver', label: 'Mountain Time - US & Canada' },
  { value: 'America/Los_Angeles', label: 'Pacific Time - US & Canada' },
  { value: 'Europe/Madrid', label: 'Madrid, España' },
  { value: 'Europe/London', label: 'Londres, UK' },
  // Puedes agregar más zonas horarias aquí
];

type TimeZoneSelectorProps = {
  value: string;
  onChange: (value: string) => void;
};

const TimeZoneSelector: React.FC<TimeZoneSelectorProps> = ({ value, onChange }) => (
  <div className="mt-6 flex items-center gap-2">
    <span className="font-medium">Zona horaria</span>
    <select
      className="ml-2 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-600"
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Seleccionar zona horaria"
      tabIndex={0}
    >
      {timeZones.map(tz => (
        <option key={tz.value} value={tz.value}>{tz.label}</option>
      ))}
    </select>
  </div>
);

export default TimeZoneSelector; 