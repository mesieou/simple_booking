import React from 'react';

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`inline-block animate-spin rounded-full border-4 border-t-transparent border-primary h-8 w-8 ${className || ''}`} role="status" aria-label="Cargando">
    <span className="sr-only">Cargando...</span>
  </div>
);

export default Spinner; 