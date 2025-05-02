'use client';

import Day from '@/components/day'

export default function CalendarCopy() {
    return (
        <div className="flex flex-col items-center justify-center h-auto bg-cyan-900">
            <h1 className="text-2xl font-bold mb-4">Calendar</h1>
            <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-md">
                <input
                    type="date"
                    className="border border-gray-300 rounded-lg p-2 w-full"
                />
            </div>
        </div>
    );
}