"use client";

import {
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  type DropItem,
  type ItemDropTarget,
  isTextDropItem,
  useDragAndDrop,
} from "react-aria-components";
import clsx from "clsx";

// Custom drag type, so cards only drop on kanban columns and never elsewhere.
const DRAG_TYPE = "application/x-app-kanban-card";

export interface AppKanbanColumn<T> {
  id: string;
  title: string;
  /** Hex color of the column dot. */
  color?: string;
  /** Secondary header content, e.g. the count and total value. */
  meta?: React.ReactNode;
  items: T[];
  /** Content under the cards, e.g. an "add" button. */
  footer?: React.ReactNode;
  emptyLabel?: string;
}

export interface AppKanbanMove {
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
  /** Index in the target column once the card is removed from its origin. */
  index: number;
}

export interface AppKanbanProps<T> {
  label: string;
  columns: AppKanbanColumn<T>[];
  getItemId: (item: T) => string;
  /** Accessible name of a card, also used as the drag text. */
  getItemLabel: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onMove: (move: AppKanbanMove) => void;
  /** Called when a card is activated (click or Enter). */
  onCardAction?: (id: string) => void;
  isDragDisabled?: boolean;
}

interface DragPayload {
  id: string;
  from: string;
}

async function readPayloads(items: DropItem[]) {
  const texts = await Promise.all(
    items.filter(isTextDropItem).map((item) => item.getText(DRAG_TYPE)),
  );

  return texts.flatMap((text) => {
    try {
      const payload = JSON.parse(text) as DragPayload;

      return typeof payload.id === "string" ? [payload] : [];
    } catch {
      return [];
    }
  });
}

function KanbanColumn<T>({
  column,
  getItemId,
  getItemLabel,
  renderCard,
  onMove,
  onCardAction,
  isDragDisabled,
}: Omit<AppKanbanProps<T>, "columns" | "label"> & {
  column: AppKanbanColumn<T>;
}) {
  const ids = column.items.map(getItemId);

  const indexAt = (target: ItemDropTarget, list: string[]) => {
    const index = list.indexOf(String(target.key));

    if (index === -1) return list.length;

    return target.dropPosition === "after" ? index + 1 : index;
  };

  const { dragAndDropHooks } = useDragAndDrop<T>({
    isDisabled: isDragDisabled,
    getItems: (keys) =>
      [...keys].map((key) => {
        const item = column.items.find((entry) => getItemId(entry) === key);

        return {
          [DRAG_TYPE]: JSON.stringify({ id: String(key), from: column.id }),
          "text/plain": item ? getItemLabel(item) : String(key),
        };
      }),
    acceptedDragTypes: [DRAG_TYPE],
    getDropOperation: () => "move",
    onReorder: (event) => {
      const itemId = String([...event.keys][0]);

      onMove({
        itemId,
        fromColumnId: column.id,
        toColumnId: column.id,
        index: indexAt(
          event.target,
          ids.filter((id) => id !== itemId),
        ),
      });
    },
    onInsert: async (event) => {
      for (const payload of await readPayloads(event.items)) {
        onMove({
          itemId: payload.id,
          fromColumnId: payload.from,
          toColumnId: column.id,
          index: indexAt(event.target, ids),
        });
      }
    },
    onRootDrop: async (event) => {
      for (const payload of await readPayloads(event.items)) {
        onMove({
          itemId: payload.id,
          fromColumnId: payload.from,
          toColumnId: column.id,
          index: ids.length,
        });
      }
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        className={({ isDropTarget }) =>
          clsx(
            "h-1 rounded-full transition-colors",
            isDropTarget ? "bg-accent" : "bg-transparent",
          )
        }
        target={target}
      />
    ),
  });

  return (
    <section
      aria-label={column.title}
      className="flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-surface-secondary"
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full bg-muted"
            style={column.color ? { backgroundColor: column.color } : undefined}
          />
          <h3 className="truncate text-sm font-semibold">{column.title}</h3>
        </div>
        {column.meta ? (
          <div className="shrink-0 text-xs text-muted tabular-nums">
            {column.meta}
          </div>
        ) : null}
      </header>

      <GridList
        aria-label={`Tarjetas en ${column.title}`}
        className={({ isDropTarget }) =>
          clsx(
            "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl px-2 pb-2 outline-none",
            isDropTarget && "bg-accent/10 ring-2 ring-accent/40",
          )
        }
        dragAndDropHooks={dragAndDropHooks}
        items={column.items}
        renderEmptyState={() => (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-separator px-3 text-center text-xs text-muted">
            {column.emptyLabel ?? "Arrastra tarjetas aquí"}
          </div>
        )}
        onAction={onCardAction ? (key) => onCardAction(String(key)) : undefined}
      >
        {(item) => (
          <GridListItem
            className={({ isDragging, isFocusVisible }) =>
              clsx(
                "group relative cursor-grab rounded-xl border border-separator bg-surface p-3 text-sm shadow-sm outline-none transition",
                "hover:border-accent/50 hover:shadow-md",
                isDragging && "opacity-40",
                isFocusVisible && "ring-2 ring-accent",
              )
            }
            id={getItemId(item)}
            textValue={getItemLabel(item)}
          >
            {/* Keyboard users start a drag from this handle (Enter, then arrows). */}
            <Button
              aria-label={`Mover ${getItemLabel(item)}`}
              className="absolute top-2 right-2 rounded-md px-1 text-muted opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent"
              slot="drag"
            >
              ⠿
            </Button>
            {renderCard(item)}
          </GridListItem>
        )}
      </GridList>

      {column.footer ? <div className="px-2 pb-2">{column.footer}</div> : null}
    </section>
  );
}

/**
 * Accessible kanban board: cards can be dragged between and within columns
 * with the mouse, touch or keyboard. The caller owns the data and persists moves.
 * Inside a height-bounded flex column it fills the remaining space and each
 * column scrolls on its own.
 */
export function AppKanban<T>({ label, columns, ...props }: AppKanbanProps<T>) {
  return (
    <div
      aria-label={label}
      className="-mx-4 flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0"
      role="region"
    >
      {columns.map((column) => (
        <KanbanColumn key={column.id} column={column} {...props} />
      ))}
    </div>
  );
}
