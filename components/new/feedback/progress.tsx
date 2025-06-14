import React from 'react';

type ProgressProps = {
  value: number; // 0-100
  className?: string;
};

const Progress: React.FC<ProgressProps> = ({ value, className }) => (
  <div className={`w-full bg-gray-200 rounded-full h-3 ${className || ''}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div
      className="bg-primary h-3 rounded-full transition-all"
      style={{ width: `${value}%` }}
    />
  </div>
);

export default Progress; 