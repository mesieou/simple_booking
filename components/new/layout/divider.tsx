import React from 'react';

type DividerProps = {
  className?: string;
  label?: string;
};

const Divider: React.FC<DividerProps> = ({ className, label }) => (
  <div className={`flex items-center w-full ${className || ''}`} role="separator" aria-orientation="horizontal">
    <hr className="flex-grow border-t border-gray-300" />
    {label && <span className="mx-4 text-gray-400 text-sm">{label}</span>}
    <hr className="flex-grow border-t border-gray-300" />
  </div>
);

export default Divider; 