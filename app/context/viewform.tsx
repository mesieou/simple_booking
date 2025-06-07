'use client';

import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';

export default function ViewForm() {
  const { data } = useFormContext();

  // Debug: show context data in the console
  console.log('Context data:', data);

  return (
    <div className="w-full min-w-[400px] max-w-xl mx-auto bg-white rounded-xl shadow-md p-6 space-y-6">
      {/* Pickup */}
      <div className="flex items-start space-x-4" tabIndex={0} aria-label="Pickup location">
        <span className="inline-block bg-gray-200 rounded-full p-2 mt-1">
          {/* Up arrow */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Pickup</span>
          <div className="font-semibold text-base text-gray-900 leading-tight">{data.pickup}</div>
        </div>
      </div>
      {/* Drop-off */}
      <div className="flex items-start space-x-4" tabIndex={0} aria-label="Drop-off location">
        <span className="inline-block bg-gray-200 rounded-full p-2 mt-1">
          {/* Down arrow */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Drop-off</span>
          <div className="font-semibold text-base text-gray-900 leading-tight">{data.dropoff}</div>
        </div>
      </div>
      {/* Arrival Date */}
      <div className="flex items-center space-x-4" tabIndex={0} aria-label="Arrival date">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Calendar icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Arrival date</span>
          <div className="ml-2 text-gray-900">{data.arrivaldate}</div>
        </div>
      </div>
      {/* Travel Cost Estimate */}
      <div className="flex items-center space-x-4" tabIndex={0} aria-label="Travel cost estimate">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Money icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Travel cost estimate</span>
          <div className="font-semibold text-gray-900">{data.travelcostestimate}</div>
        </div>
      </div>
      {/* Travel Time Estimate */}
      <div className="flex items-center space-x-4" tabIndex={0} aria-label="Travel time estimate">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Clock icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Travel time estimate</span>
          <div className="font-semibold text-gray-900">{data.traveltimeestimete}</div>
        </div>
      </div>
      {/* Service ID */}
      <div className="flex items-center space-x-4" tabIndex={0} aria-label="Service ID">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Tag icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H8a1 1 0 01-1-1V7zm0 0l10 10" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Service ID</span>
          <div className="font-semibold text-gray-900">{data.serviceid}</div>
        </div>
      </div>
      {/* Notes */}
      <div className="flex items-center space-x-4" tabIndex={0} aria-label="Notes">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Note icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Notes</span>
          <div className="font-semibold text-gray-900">{data.notes}</div>
        </div>
      </div>
    </div>
  );
}