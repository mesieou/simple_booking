import React from 'react';

const zeroList = [
    'missed bookings.',
    'manual scheduling.',
    'double bookings.',
    'frustrated customers.',
    'transaction fees.'
  ];

const ZeroFeesSection: React.FC = () => (
  <section
    className="w-screen relative left-1/2 ml-[-50vw] bg-[#EAD6F9] flex justify-center items-center"
    aria-label="Zero fees section"
    style={{ boxSizing: 'border-box' }}
  >
    <div className="max-w-7xl w-full rounded-2xl py-24 px-4 sm:px-8 flex flex-col md:flex-row items-center justify-center gap-8">
      {/* SVG 0 */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <ellipse
            cx="90"
            cy="90"
            rx="80"
            ry="80"
            stroke="#3B27C1"
            strokeWidth="3"
          />
          <ellipse
            cx="90"
            cy="90"
            rx="35"
            ry="50"
            stroke="#3B27C1"
            strokeWidth="3"
          />
          {/* Dibujo de líneas en la esquina inferior izquierda */}
          <g>
            <rect x="25" y="135" width="10" height="10" fill="none" stroke="#3B27C1" strokeWidth="2"/>
            <rect x="40" y="135" width="10" height="10" fill="none" stroke="#3B27C1" strokeWidth="2"/>
            <rect x="25" y="120" width="10" height="10" fill="none" stroke="#3B27C1" strokeWidth="2"/>
            <rect x="40" y="120" width="10" height="10" fill="none" stroke="#3B27C1" strokeWidth="2"/>
          </g>
        </svg>
      </div>
      {/* Lista de textos */}
      <ul className="flex flex-col gap-2 text-left">
        {zeroList.map((item) => (
          <li
            key={item}
            className="text-2xl sm:text-3xl font-bold text-[#3B27C1] leading-tight"
            tabIndex={0}
            aria-label={item}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default ZeroFeesSection; 