import React from 'react';

interface BookingSummaryProps {
  origen: string;
  origenDireccion: string;
  destino: string;
  destinoDireccion: string;
  vehiculo: string;
  luggers: number;
  precioBase: number;
  precioPorMinuto: number;
  arrivalWindow: string;
  moving: string;
}

export default function BookingSummary({
  origen,
  origenDireccion,
  destino,
  destinoDireccion,
  vehiculo,
  luggers,
  precioBase,
  precioPorMinuto,
  arrivalWindow,
  moving
}: BookingSummaryProps) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-6 space-y-6">
      {/* Pickup */}
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 mt-1">
          {/* Flecha arriba */}
          <span className="inline-block bg-gray-200 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500">Pickup</span>
          <div className="font-semibold text-base text-gray-900 leading-tight">{origen}</div>
          <div className="text-xs text-gray-500">{origenDireccion}</div>
        </div>
      </div>
      {/* Drop-off */}
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 mt-1">
          {/* Flecha abajo */}
          <span className="inline-block bg-gray-200 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500">Drop-off</span>
          <div className="font-semibold text-base text-gray-900 leading-tight">{destino}</div>
          <div className="text-xs text-gray-500">{destinoDireccion}</div>
        </div>
      </div>
      {/* Vehicle */}
      <div className="flex items-center space-x-4">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Icono camión */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Vehicle</span>
          <span className="ml-2 font-medium text-gray-900">{vehiculo}</span>
          <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">{luggers} Luggers</span>
        </div>
      </div>
      {/* Price */}
      <div className="flex items-center space-x-4">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Icono precio */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Price</span>
          <div className="font-semibold text-gray-900">${precioBase.toFixed(2)} + ${precioPorMinuto.toFixed(2)} per min labor
            <span className="ml-1 inline-block align-middle">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-700 inline" fill="none" viewBox="0 0 20 20" stroke="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            </span>
          </div>
        </div>
      </div>
      {/* Arrival window */}
      <div className="flex items-center space-x-4">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Icono calendario */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </span>
        <div>
          <span className="text-xs text-gray-500">Arrival window</span>
          <div className="ml-2 text-gray-900">{arrivalWindow}</div>
        </div>
      </div>
      {/* What you're moving */}
      <div className="flex items-start space-x-4">
        <span className="inline-block bg-gray-200 rounded-full p-2">
          {/* Icono caja */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
        </span>
        <div className="flex-1">
          <span className="text-xs text-gray-500">What you're moving</span>
          <textarea 
            className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white"
            rows={3}
            value={moving}
            readOnly
          />
        </div>
      </div>
    </div>
  );
} 