import React from 'react';

type Option = {
  value: string;
  label: string;
};

type RadioGroupProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  label?: string;
  className?: string;
};

const RadioGroup: React.FC<RadioGroupProps> = ({ options, value, onChange, name, label, className }) => (
  <fieldset className={`flex flex-col gap-2 ${className || ''}`}>
    {label && <legend className="text-sm font-medium text-gray-700">{label}</legend>}
    {options.map(opt => (
      <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={name}
          value={opt.value}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
          className="form-radio text-primary focus:ring-primary"
        />
        <span>{opt.label}</span>
      </label>
    ))}
  </fieldset>
);

export default RadioGroup; 