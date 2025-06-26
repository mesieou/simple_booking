// Este archivo será movido a components/sections/precios.tsx
'use client';

import React from "react";

interface PreciosProps {
    base?: number;
    labor_min?: number;
}

const Precios: React.FC<PreciosProps> = ({ base = 0, labor_min = 0 }) => {
    return (
        <div
            className="flex items-baseline space-x-2 text-black font-bold text-2xl md:text-3xl"
            aria-label="Precio base más precio por minuto de labor"
        >
            <span>${base}</span>
            <span>+</span>
            <span>${labor_min}</span>
            <span className="text-base font-normal ml-1 align-bottom text-black/80">per minute</span>
        </div>
    );
};

export default Precios;
