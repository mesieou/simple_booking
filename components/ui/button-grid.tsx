'use client';

interface ButtonGridProps {
  items: {
    id: string | number;
    label: string;
    onClick?: () => void;
    className?: string;
  }[];
  columns?: number;
  gap?: number;
  className?: string;
}

export function ButtonGrid({ 
  items, 
  columns = 2, 
  gap = 2, 
  className = '' 
}: ButtonGridProps) {
  return (
    <div 
      className={`grid grid-cols-${columns} gap-${gap} ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className={`bg-blue-500 text-white text-sm px-2 py-1 rounded hover:bg-blue-600 transition ${item.className || ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
} 