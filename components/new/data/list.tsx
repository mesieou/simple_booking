import React from 'react';

type ListProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  ordered?: boolean;
  label?: string;
};

function List<T>({ items, renderItem, className, ordered = false, label }: ListProps<T>) {
  const ListTag = ordered ? 'ol' : 'ul';
  return (
    <ListTag className={`list-inside ${ordered ? 'list-decimal' : 'list-disc'} ${className || ''}`} aria-label={label}>
      {items.map((item, i) => (
        <li key={i} className="mb-1">
          {renderItem(item, i)}
        </li>
      ))}
    </ListTag>
  );
}

export default List; 