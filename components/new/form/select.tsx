import React from 'react';

type Option = {
  value: string;
  label: string;
};

type SelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  className?: string;
};

const Select: React.FC<SelectProps> = ({ options, value, onChange, label, id, className }) => (
  <div className={`flex flex-col gap-1 ${className || ''}`}>
    {label && (
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
    )}
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border rounded-md px-3 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={label}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export default Select; 