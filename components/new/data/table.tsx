import React from 'react';

type TableColumn<T> = {
  key: keyof T;
  header: string;
  render?: (value: any, row: T) => React.ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  className?: string;
};

function Table<T extends object>({ columns, data, className }: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className || ''}`}>
      <table className="min-w-full border border-primary bg-white/0 backdrop-blur-md rounded-lg">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={String(col.key)} className="px-4 py-2 border-primary text-left bg-white/0 backdrop-blur-md font-semibold text-yellow-200">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-4 text-center text-gray-400">No data</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="even:bg-white/0 backdrop-blur-md border-b border-primary">
                {columns.map(col => (
                  <td key={String(col.key)} className="px-4 py-2 border-b">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table; 