import React from 'react';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange, className }) => {
  if (totalPages <= 1) return null;
  return (
    <nav className={`flex items-center gap-2 ${className || ''}`} aria-label="Paginación">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1 rounded border bg-white text-gray-700 disabled:opacity-50"
        aria-label="Anterior"
      >
        &lt;
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
        <button
          key={num}
          onClick={() => onPageChange(num)}
          className={`px-3 py-1 rounded border ${num === page ? 'bg-primary text-white' : 'bg-white text-gray-700'} transition-colors`}
          aria-current={num === page ? 'page' : undefined}
        >
          {num}
        </button>
      ))}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1 rounded border bg-white text-gray-700 disabled:opacity-50"
        aria-label="Siguiente"
      >
        &gt;
      </button>
    </nav>
  );
};

export default Pagination; 