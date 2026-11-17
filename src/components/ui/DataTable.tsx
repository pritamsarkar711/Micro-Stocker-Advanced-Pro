import clsx from 'clsx';
import { useMemo, useState, type ReactNode } from 'react';
import { GIcon } from './GoogleIcon';
import { EmptyState } from './Misc';

export type BreakpointKey = 'sm' | 'md' | 'lg' | 'xl';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  hideBelow?: BreakpointKey;
  primary?: boolean;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  width?: string;
}

const HIDE_BELOW: Record<BreakpointKey, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  dense?: boolean;
  footer?: ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  emptyTitle = 'Empty',
  emptyDescription,
  emptyAction,
  dense = false,
  footer,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const value = (row: T) =>
      column.sortValue
        ? column.sortValue(row)
        : String((row as Record<string, unknown>)[column.key] ?? '');
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? result : -result;
    });
  }, [rows, columns, sort]);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const toggleSort = (column: Column<T>) => {
    if (!column.sortable) return;
    setSort((prev) =>
      prev?.key === column.key
        ? prev.dir === 'asc'
          ? { key: column.key, dir: 'desc' }
          : null
        : { key: column.key, dir: 'asc' },
    );
  };

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary);
  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-2.5';

  return (
    <div className="w-full">
      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={clsx(
                    cellPad,
                    'text-2xs font-semibold tracking-[0.04em] text-fg-subtle uppercase',
                    ALIGN[column.align ?? 'left'],
                    column.hideBelow ? HIDE_BELOW[column.hideBelow] : undefined,
                    column.sortable && 'cursor-pointer select-none hover:text-fg',
                  )}
                  onClick={() => toggleSort(column)}
                  aria-sort={
                    sort?.key === column.key
                      ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1',
                      column.align === 'right' && 'flex-row-reverse',
                    )}
                  >
                    {column.header}
                    {column.sortable &&
                      (sort?.key === column.key ? (
                        sort.dir === 'asc' ? (
                          <GIcon name="arrow_upward" size={13} />
                        ) : (
                          <GIcon name="arrow_downward" size={13} />
                        )
                      ) : (
                        <GIcon name="unfold_more" size={13} className="opacity-45" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  'border-b border-line/70 last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-2',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(
                      cellPad,
                      'align-middle text-fg',
                      ALIGN[column.align ?? 'left'],
                      column.hideBelow ? HIDE_BELOW[column.hideBelow] : undefined,
                    )}
                  >
                    {column.render
                      ? column.render(row)
                      : String((row as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 p-2 md:hidden">
        {sorted.map((row) => (
          <li key={rowKey(row)}>
            <div
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                'r-control border border-line bg-surface p-3',
                onRowClick && 'cursor-pointer active:bg-surface-2',
              )}
            >
              <div className="text-[0.8125rem] font-semibold text-fg">
                {primary.render
                  ? primary.render(row)
                  : String((row as Record<string, unknown>)[primary.key] ?? '')}
              </div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                {secondary.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="truncate text-2xs tracking-wide text-fg-subtle uppercase">
                      {column.header}
                    </dt>
                    <dd className="truncate text-[0.8125rem] text-fg">
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '')}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>

      {footer && (
        <div className="border-t border-line px-3.5 py-2 text-[0.75rem] text-fg-muted">{footer}</div>
      )}
    </div>
  );
}
