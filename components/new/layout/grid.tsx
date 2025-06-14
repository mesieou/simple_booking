import React from 'react';

type GridProps = {
  children: React.ReactNode;
  cols?: number;
  gap?: number;
  className?: string;
};

const Grid: React.FC<GridProps> = ({ children, cols = 3, gap = 4, className }) => (
  <div
    className={`grid grid-cols-${cols} gap-${gap} ${className || ''}`}
    role="list"
  >
    {children}
  </div>
);

export default Grid; 