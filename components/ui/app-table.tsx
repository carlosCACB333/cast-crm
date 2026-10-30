"use client";

import { Table } from "@heroui/react";
import clsx from "clsx";

import { TABLE_DEFAULTS } from "@/config/tables";

import { AppHeaderFilter, type AppTableFilter } from "./app-table-filter";

export interface AppTableColumn<K extends string> {
  key: K;
  label: string;
  /** Column that names the row for screen readers; defaults to the first one. */
  isRowHeader?: boolean;
  allowsSorting?: boolean;
  className?: string;
  /** Filter opened from an icon next to the column title. */
  filter?: AppTableFilter;
  /** Fixed width in px (e.g. an actions column); it cannot be resized. */
  width?: number;
  /** Initial width of a resizable column, in px or a fraction like "2fr". */
  defaultWidth?: number | `${number}fr`;
  minWidth?: number;
}

export interface AppTableSort<K extends string = string> {
  column: K;
  direction: "ascending" | "descending";
}

export interface AppTableProps<T, K extends string> {
  label: string;
  columns: AppTableColumn<K>[];
  rows: T[];
  getRowKey: (row: T) => string;
  renderCell: (row: T, column: K) => React.ReactNode;
  emptyContent?: React.ReactNode;
  /**
   * Current sort for columns with `allowsSorting`. Sorting is done by the
   * caller; it may name an order that is not a column (e.g. manual position),
   * in which case no column shows the indicator.
   */
  sort?: AppTableSort;
  onSortChange?: (sort: AppTableSort<K>) => void;
  /** Called when a row is activated (click or Enter), e.g. to open its detail. */
  onRowAction?: (key: string) => void;
  /** Dims the rows while newer data is loading. */
  isLoading?: boolean;
  /** Lets the user drag the column edges to change their width. */
  isResizable?: boolean;
  footer?: React.ReactNode;
}

export function AppTable<T, K extends string>({
  label,
  columns,
  rows,
  getRowKey,
  renderCell,
  emptyContent = "Sin resultados",
  sort,
  onSortChange,
  onRowAction,
  isLoading,
  isResizable = false,
  footer,
}: AppTableProps<T, K>) {
  const Container = isResizable
    ? Table.ResizableContainer
    : Table.ScrollContainer;

  return (
    <Table>
      <Container>
        <Table.Content
          aria-busy={isLoading || undefined}
          aria-label={label}
          className={clsx(
            "min-w-[640px] transition-opacity",
            isLoading && "opacity-60",
          )}
          sortDescriptor={sort}
          onRowAction={
            onRowAction ? (key) => onRowAction(String(key)) : undefined
          }
          onSortChange={
            onSortChange
              ? (descriptor) =>
                  onSortChange({
                    column: String(descriptor.column) as K,
                    direction: descriptor.direction,
                  })
              : undefined
          }
        >
          <Table.Header>
            {columns.map((column, index) => {
              // React Aria needs one row header; the first column by default.
              const isRowHeader =
                column.isRowHeader ??
                (index === 0 && !columns.some((item) => item.isRowHeader));
              // The last column fills the remaining space, so it has no handle.
              const hasResizer =
                isResizable && !column.width && index < columns.length - 1;

              return (
                <Table.Column
                  key={column.key}
                  allowsSorting={column.allowsSorting}
                  className={column.className}
                  defaultWidth={column.defaultWidth}
                  id={column.key}
                  isRowHeader={isRowHeader}
                  minWidth={
                    column.minWidth ??
                    (isResizable ? TABLE_DEFAULTS.minColumnWidth : undefined)
                  }
                  width={column.width}
                >
                  {({ sortDirection }) => {
                    const title = column.allowsSorting ? (
                      <Table.SortableColumnHeader sortDirection={sortDirection}>
                        {column.label}
                      </Table.SortableColumnHeader>
                    ) : (
                      column.label
                    );

                    return (
                      <>
                        {column.filter ? (
                          <span className="inline-flex items-center gap-1">
                            {title}
                            <AppHeaderFilter filter={column.filter} />
                          </span>
                        ) : (
                          title
                        )}
                        {hasResizer ? (
                          <Table.ColumnResizer
                            aria-label={`Cambiar ancho de ${column.label}`}
                          />
                        ) : null}
                      </>
                    );
                  }}
                </Table.Column>
              );
            })}
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <div className="py-10 text-center text-sm text-muted">
                {emptyContent}
              </div>
            )}
          >
            {rows.map((row) => (
              <Table.Row
                key={getRowKey(row)}
                className={onRowAction ? "cursor-pointer" : undefined}
                id={getRowKey(row)}
              >
                {columns.map((column) => (
                  <Table.Cell key={column.key} className={column.className}>
                    {renderCell(row, column.key)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Container>
      {footer ? <Table.Footer>{footer}</Table.Footer> : null}
    </Table>
  );
}
