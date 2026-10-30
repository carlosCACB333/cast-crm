"use client";

import { Pagination } from "@heroui/react";

export interface AppPaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  summary?: React.ReactNode;
}

/** Page numbers to show: always the first, last and neighbours of the current page. */
function visiblePages(page: number, pageCount: number) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((item) => item >= 1 && item <= pageCount)
    .sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];

  sorted.forEach((item, index) => {
    if (index > 0 && item - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(item);
  });

  return result;
}

export function AppPagination({
  page,
  pageCount,
  onChange,
  summary,
}: AppPaginationProps) {
  return (
    <Pagination
      className="flex-col gap-3 sm:flex-row sm:justify-between"
      size="sm"
    >
      {summary ? <Pagination.Summary>{summary}</Pagination.Summary> : <span />}
      {pageCount > 1 ? (
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={page <= 1}
              onPress={() => onChange(page - 1)}
            >
              <Pagination.PreviousIcon />
              <span className="sr-only sm:not-sr-only">Anterior</span>
            </Pagination.Previous>
          </Pagination.Item>
          {visiblePages(page, pageCount).map((item, index) =>
            item === "ellipsis" ? (
              <Pagination.Item key={`ellipsis-${index}`}>
                <Pagination.Ellipsis />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={item}>
                <Pagination.Link
                  aria-label={`Página ${item}`}
                  isActive={item === page}
                  onPress={() => onChange(item)}
                >
                  {item}
                </Pagination.Link>
              </Pagination.Item>
            ),
          )}
          <Pagination.Item>
            <Pagination.Next
              isDisabled={page >= pageCount}
              onPress={() => onChange(page + 1)}
            >
              <span className="sr-only sm:not-sr-only">Siguiente</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      ) : null}
    </Pagination>
  );
}
