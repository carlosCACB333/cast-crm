import clsx from "clsx";

export interface AppStatusChipProps {
  label: string;
  /** Any hex color, e.g. picked by the user for a status or stage. */
  color: string;
  className?: string;
}

/**
 * Soft chip for user-colored labels. Background and text are mixed with the
 * theme colors so any picked color stays readable in light and dark mode.
 */
export function AppStatusChip({ label, color, className }: AppStatusChipProps) {
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
        color: `color-mix(in oklab, ${color} 65%, var(--foreground))`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
