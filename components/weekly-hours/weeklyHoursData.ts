export type TimeRange = { start: string; end: string };
export type DayAvailability = {
  day: string; // 'Sunday', 'Monday', etc.
  available: boolean;
  ranges: TimeRange[];
};
export type WeeklyHoursData = {
  days: DayAvailability[];
  timeZone: string;
};

export const weeklyHoursData: WeeklyHoursData = {
  days: [
    { day: 'Sunday', available: false, ranges: [] },
    { day: 'Monday', available: true, ranges: [{ start: '09:00', end: '17:00' }] },
    { day: 'Tuesday', available: true, ranges: [{ start: '09:00', end: '17:00' }] },
    { day: 'Wednesday', available: true, ranges: [{ start: '09:00', end: '17:00' }] },
    { day: 'Thursday', available: true, ranges: [{ start: '09:00', end: '17:00' }] },
    { day: 'Friday', available: true, ranges: [{ start: '09:00', end: '17:00' }] },
    { day: 'Saturday', available: false, ranges: [] },
  ],
  timeZone: 'America/New_York',
}; 