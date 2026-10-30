import { Card } from "@heroui/react";
import clsx from "clsx";

import { formatPercent } from "@/lib/pricing";

import { AppSparkline } from "./app-chart";
import { AppSkeleton } from "./app-skeleton";

type Tone = "accent" | "warning" | "danger" | "success";

export interface AppStatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  isLoading?: boolean;
  /** Short context under the value, e.g. "3 sin stock". */
  hint?: React.ReactNode;
  /** Color of the icon; `warning`/`danger` call attention to the number. */
  tone?: Tone;
  /** Value of the current and the previous period, shown as a change chip. */
  change?: { current: number; previous: number };
  /** Recent values, oldest first, drawn as a sparkline at the bottom. */
  trend?: number[];
}

const toneClasses: Record<Tone, string> = {
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

const toneColors: Record<Tone, string> = {
  accent: "var(--chart-1)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

/** "↑ +25 %" against the previous period; an absolute change when it was 0. */
function ChangeChip({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const amount =
    previous > 0
      ? formatPercent(Math.round((Math.abs(diff) / previous) * 100))
      : Math.abs(diff).toLocaleString();

  return (
    <span
      className={clsx(
        "inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        diff > 0 && "bg-success/10 text-success",
        diff < 0 && "bg-danger/10 text-danger",
        diff === 0 && "bg-default text-muted",
      )}
      title="Respecto al periodo anterior"
    >
      <span aria-hidden="true">{diff > 0 ? "↑" : diff < 0 ? "↓" : "→"}</span>
      {sign}
      {amount}
      <span className="sr-only"> respecto al periodo anterior</span>
    </span>
  );
}

/** Key figure with its icon, for summary rows at the top of a page. */
export function AppStatCard({
  label,
  value,
  icon,
  isLoading,
  hint,
  tone = "accent",
  change,
  trend,
}: AppStatCardProps) {
  return (
    <Card className="h-full w-full gap-2 overflow-hidden">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            toneClasses[tone],
          )}
        >
          {icon}
        </span>
        <span className="truncate text-sm font-medium text-muted">{label}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {isLoading ? (
          <AppSkeleton className="h-8 w-16 rounded-lg" />
        ) : (
          <span className="truncate text-2xl font-bold tracking-tight tabular-nums">
            {value}
          </span>
        )}
        {change && !isLoading ? <ChangeChip {...change} /> : null}
      </div>
      {hint && !isLoading ? (
        <span className="truncate text-xs text-muted">{hint}</span>
      ) : null}
      {trend && !isLoading ? (
        <div className="-mx-4 -mb-4 mt-auto">
          <AppSparkline color={toneColors[tone]} label={label} values={trend} />
        </div>
      ) : null}
    </Card>
  );
}
