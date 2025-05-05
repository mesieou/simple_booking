// lib/bot/helpers/slots.ts

/**
 * Slot helper:
 * Generates 4 default time windows (8-10, 10-12, 12-14, 14-16)
 * for the date the user picked. It returns an array of objects
 * because that survives JSON round-tripping in the chat history
 */

// import {endOfMinute, format, setHours, setMinutes} from "date-fns";

// Shape used by the bot /UI
export type Slot = { id: string; label: string };

/** 
 * Given "2025-05-15", returns:
 * [
 *   { id: "slot-1", label: "08:00 – 10:00" },
 *   { id: "slot-2", label: "10:00 – 12:00" },
 *   …
 * ]
 */
export function makeSlots(dateStr: string): Slot[] {
  const windows: [number, number][] = [
    [8, 10],
    [10, 12],
    [12, 14],
    [14, 16],
  ];

  const pad = (n: number) => String(n).padStart(2, "0") + ":00";

  return windows.map(([from, to], idx) => ({
    id: `slot-${idx + 1}`,
    label: `${pad(from)} - ${pad(to)}`,
  }));
}