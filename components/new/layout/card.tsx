import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

const Card: React.FC<CardProps> = ({ children, className, title }) => (
  <div className={`bg-blue-500/20 backdrop-blur-md border border-blue-300/30 rounded-lg shadow p-6 ${className || ''}`} role="region" aria-label={title || 'Card'}>
    {title && <h3 className="text-lg font-bold mb-2">{title}</h3>}
    {children}
  </div>
);

export default Card; 