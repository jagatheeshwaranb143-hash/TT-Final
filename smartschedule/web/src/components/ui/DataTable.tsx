import React from 'react';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, isLoading, emptyMessage = 'No data available' }: DataTableProps<T>) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, i) => <th key={i}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={i}>
                {columns.map((col, j) => {
                  const val = (row as any)[col.key as string];
                  return <td key={j}>{col.render ? col.render(val, row) : val}</td>;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
