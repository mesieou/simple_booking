'use client'

import React, { InputHTMLAttributes, useState, useEffect, useRef } from 'react';

// Extend standard input props so we can pass type, id, value, onChange, etc.
interface DirectionProps extends InputHTMLAttributes<HTMLInputElement> {
  texto: string;
}

export default function Direction({ texto, value, onChange, ...inputProps }: DirectionProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value as string);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await response.json();

      if (data.predictions) {
        setSuggestions(data.predictions.map((prediction: any) => prediction.description));
      }
    } catch (error) {
      console.error('Error al obtener sugerencias:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(e);
    fetchSuggestions(newValue);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    const event = {
      target: { value: suggestion }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(event);
    setShowSuggestions(false);
  };

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
              value={inputValue}
              onChange={handleInputChange}
              className="block w-full text-label-2 leading-[1.375] focus:outline-none flex-1 bg-transparent border-none focus:ring-0 placeholder:text-gray-600 text-black caret-black"
            />
          </div>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-black"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}