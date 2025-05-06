'use client'

import React, { InputHTMLAttributes } from 'react';

// Extend standard input props so we can pass type, id, value, onChange, etc.
interface DirectionProps extends InputHTMLAttributes<HTMLInputElement> {
  texto: string;
}

export default function Direction({ texto, ...inputProps }: DirectionProps) {
  return (
    <div className="w-full">
      <div className="relative">
        <div className="relative border rounded-xl px-3.5 py-3 flex items-center gap-x-4 flex-wrap transition text-black bg-white border-gray-400 focus-within:border-brand hover:border-brand">
          <div className="pointer-events-none flex h-5 w-5 items-center justify-center">
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-grow">
            <label htmlFor={inputProps.id} className="block text-label-5 text-left text-gray-600">
              {texto}
            </label>
            <input
              {...inputProps}
              className="block w-full text-label-2 leading-[1.375] focus:outline-none flex-1 bg-transparent border-none focus:ring-0 placeholder:text-gray-600 text-black caret-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
}