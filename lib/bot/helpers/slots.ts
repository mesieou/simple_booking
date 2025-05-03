// lib/bot/helpers/slots.ts

/**
 * Slot helper:
 * Generates 4 default time windows (8-10, 10-12, 12-14, 14-16)
 * for the date the user picked. It returns an array of objects
 * because that survives JSON round-tripping in the chat history
 */

import {endOfMinute, format, setHours, setMinutes} from "date-fns";

// Shape used by the bot /UI
export type Slot = {
    id:string;
    label:string;
};

// Make slots ("2025-05-15") => [ { id:"slot-0", label:"May 15 08-10"}, ... ]

export function makeSlots(dateStr: string): Slot[] {
    // Crude parse is fine for now (date-fns parse is overkill for the testing)
    const baseDate = new Date(dateStr);

    // windows we support (24 hrs format)
    const windows: Array<[number, number]> = [ 
        [8,10],
        [10, 12],
        [12, 14],
        [14, 16],
    ];

    // build one slot obj per window 
    return windows.map(([from, to], idx) => {
        const start = setMinutes(setHours(baseDate, from), 0);
        const end = setMinutes(setHours(baseDate, to), 0);

        return {
            id: `slot-${idx}`,
            label: `${format(start, "MMM d")} ${format(start, "HH")}-${format(end, "HH")}`,
        };
    });
} 