"use client";

import type { TooltipContentProps } from "recharts";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";

import { AppSkeleton } from "./app-skeleton";

// Charts share one look: recessive grid and axes in the theme's muted ink,
// thin marks with rounded data ends, a tooltip on hover and a legend whenever
// there is more than one series. Series colors come from the `--chart-*`
// tokens in `styles/globals.css`, always assigned in the same order.

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)"] as const;

const axisTick = { fill: "var(--muted)", fontSize: 12 };

type Formatter = (value: number) => string;

const defaultFormat: Formatter = (value) => value.toLocaleString();

function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
}: TooltipContentProps & {
  formatLabel?: (label: string) => string;
  formatValue: Formatter;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="flex min-w-36 flex-col gap-1.5 rounded-xl border border-separator bg-overlay px-3 py-2 text-xs text-overlay-foreground shadow-lg">
      <span className="font-medium">
        {formatLabel ? formatLabel(String(label)) : label}
      </span>
      {payload.map((entry) => (
        <span
          key={String(entry.dataKey)}
          className="flex items-center justify-between gap-4"
        >
          <span className="flex items-center gap-1.5 text-muted">
            <span
              className="size-2 rounded-full"
              style={{ background: entry.payload?.color ?? entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium tabular-nums">
            {formatValue(Number(entry.value))}
          </span>
        </span>
      ))}
    </div>
  );
}

function ChartLegend({ series }: { series: { label: string }[] }) {
  if (series.length < 2) return null;

  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted">
      {series.map((item, index) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: SERIES_COLORS[index] }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Vertical fade under an area, from a light tint to transparent. */
function AreaFill({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.25} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

export interface AppTrendChartProps<T extends object> {
  /** Accessible name of the chart. */
  label: string;
  data: T[];
  /** Key of the category on the x axis, e.g. the month. */
  xKey: keyof T & string;
  /** Up to two series, colored in this order. */
  series: { key: keyof T & string; label: string }[];
  /** Bars compare amounts per period; an area shows how one value evolves. */
  kind?: "bar" | "area";
  formatX?: (value: string) => string;
  formatValue?: Formatter;
  isLoading?: boolean;
  height?: number;
}

/** Values over time (one row per period), as grouped bars or an area. */
export function AppTrendChart<T extends object>({
  label,
  data,
  xKey,
  series,
  kind = "bar",
  formatX,
  formatValue = defaultFormat,
  isLoading,
  height = 240,
}: AppTrendChartProps<T>) {
  const gradientId = useId();

  if (isLoading) {
    return (
      <div style={{ height }}>
        <AppSkeleton className="size-full rounded-xl" />
      </div>
    );
  }

  const Chart = kind === "bar" ? BarChart : AreaChart;
  // The generic only types the props; Recharts reads the rows by key.
  const rows = data as Record<string, unknown>[];

  return (
    <figure className="flex flex-col gap-3">
      <ChartLegend series={series} />
      <div aria-label={label} role="img" style={{ height }}>
        <ResponsiveContainer height="100%" width="100%">
          <Chart barGap={2} data={rows} margin={{ top: 8, right: 8 }}>
            <defs>
              {series.map((item, index) => (
                <AreaFill
                  key={item.key}
                  color={SERIES_COLORS[index]}
                  id={`${gradientId}-${index}`}
                />
              ))}
            </defs>
            <CartesianGrid stroke="var(--separator)" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey={xKey as string}
              tick={axisTick}
              tickFormatter={formatX}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={axisTick}
              tickFormatter={formatValue}
              tickLine={false}
              width="auto"
            />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  {...props}
                  formatLabel={formatX}
                  formatValue={formatValue}
                />
              )}
              cursor={
                kind === "bar"
                  ? { fill: "var(--default)", opacity: 0.6 }
                  : { stroke: "var(--muted)", strokeDasharray: "4 4" }
              }
            />
            {series.map((item, index) =>
              kind === "bar" ? (
                <Bar
                  key={item.key}
                  dataKey={item.key as string}
                  fill={SERIES_COLORS[index]}
                  maxBarSize={28}
                  name={item.label}
                  radius={[4, 4, 0, 0]}
                />
              ) : (
                <Area
                  key={item.key}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                  dataKey={item.key as string}
                  fill={`url(#${gradientId}-${index})`}
                  name={item.label}
                  stroke={SERIES_COLORS[index]}
                  strokeWidth={2}
                  type="monotone"
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export interface AppBreakdownItem {
  id: string;
  label: string;
  value: number;
  /** Color the organization gave to the item (stage, status…). */
  color?: string;
}

export interface AppBreakdownChartProps {
  /** Accessible name of the chart. */
  label: string;
  /** Name of the measure in the tooltip, e.g. "Clientes". */
  valueLabel: string;
  items: AppBreakdownItem[];
  formatValue?: Formatter;
  isLoading?: boolean;
}

const ROW_HEIGHT = 36;

/** Horizontal bars comparing categories, labeled with their value. */
export function AppBreakdownChart({
  label,
  valueLabel,
  items,
  formatValue = defaultFormat,
  isLoading,
}: AppBreakdownChartProps) {
  const height = Math.max(items.length, 3) * ROW_HEIGHT + 8;

  if (isLoading) {
    return <AppSkeleton className="h-48 w-full rounded-xl" />;
  }

  return (
    <div aria-label={label} role="img" style={{ height }}>
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={items}
          layout="vertical"
          margin={{ top: 4, right: 72, bottom: 4 }}
        >
          <XAxis hide dataKey="value" type="number" />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            type="category"
            width="auto"
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip {...props} formatValue={formatValue} />
            )}
            cursor={{ fill: "var(--default)", opacity: 0.6 }}
          />
          <Bar
            barSize={18}
            dataKey="value"
            fill={SERIES_COLORS[0]}
            minPointSize={2}
            name={valueLabel}
            radius={[0, 4, 4, 0]}
            shape={(props) => (
              <Rectangle
                {...props}
                fill={props.payload?.color ?? SERIES_COLORS[0]}
              />
            )}
          >
            <LabelList
              className="tabular-nums"
              dataKey="value"
              fill="var(--foreground)"
              fontSize={12}
              formatter={(value) => formatValue(Number(value))}
              position="right"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface AppSparklineProps {
  /** Accessible name, e.g. the metric it belongs to. */
  label: string;
  /** Oldest first. */
  values: number[];
  color?: string;
}

/** Axis-less trend under a key figure; marks the latest value with a dot. */
export function AppSparkline({
  label,
  values,
  color = SERIES_COLORS[0],
}: AppSparklineProps) {
  const gradientId = useId();
  const rows = values.map((value, index) => ({ index, value }));
  const last = rows.length - 1;

  return (
    <div aria-label={`Tendencia de ${label}`} className="h-10" role="img">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart
          data={rows}
          margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
        >
          <defs>
            <AreaFill color={color} id={gradientId} />
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            dataKey="value"
            dot={(props) => (
              <circle
                key={props.index}
                cx={props.cx}
                cy={props.cy}
                fill={color}
                r={props.index === last ? 4 : 0}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            )}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            stroke={color}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface AppDistributionProps {
  /** Accessible name of the chart. */
  label: string;
  items: AppBreakdownItem[];
  formatValue?: Formatter;
  isLoading?: boolean;
}

const percentOf = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

/** Parts of a whole: a segmented bar and a legend with each value and share. */
export function AppDistribution({
  label,
  items,
  formatValue = defaultFormat,
  isLoading,
}: AppDistributionProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <AppSkeleton className="h-2.5 w-full rounded-full" />
        <AppSkeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  const visible = items.filter((item) => item.value > 0);

  return (
    <figure aria-label={label} className="flex flex-col gap-4">
      <div aria-hidden="true" className="flex h-2.5 gap-0.5">
        {visible.map((item) => (
          <span
            key={item.id}
            className="h-full rounded-full"
            style={{
              background: item.color ?? SERIES_COLORS[0],
              flexGrow: item.value,
            }}
            title={`${item.label}: ${formatValue(item.value)}`}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: item.color ?? SERIES_COLORS[0] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">
              {item.label}
            </span>
            <span className="font-semibold tabular-nums">
              {formatValue(item.value)}
            </span>
            <span className="w-10 text-right text-xs text-muted tabular-nums">
              {percentOf(item.value, total)} %
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export interface AppGaugeProps {
  /** Share between 0 and 1; null shows a dash. */
  value: number | null;
  /** Caption inside the ring, e.g. "Ganados". */
  caption: string;
  isLoading?: boolean;
}

const GAUGE_RADIUS = 52;
const GAUGE_LENGTH = 2 * Math.PI * GAUGE_RADIUS;

/** Ring with a percentage in the middle. */
export function AppGauge({ value, caption, isLoading }: AppGaugeProps) {
  if (isLoading) {
    return <AppSkeleton className="mx-auto size-36 rounded-full" />;
  }

  const share = Math.min(Math.max(value ?? 0, 0), 1);

  return (
    <div className="relative mx-auto size-36">
      <svg
        aria-hidden="true"
        className="size-full -rotate-90"
        viewBox="0 0 120 120"
      >
        <circle
          cx="60"
          cy="60"
          fill="none"
          r={GAUGE_RADIUS}
          stroke="var(--default)"
          strokeWidth="10"
        />
        {share > 0 ? (
          <circle
            cx="60"
            cy="60"
            fill="none"
            r={GAUGE_RADIUS}
            stroke={SERIES_COLORS[0]}
            strokeDasharray={`${share * GAUGE_LENGTH} ${GAUGE_LENGTH}`}
            strokeLinecap="round"
            strokeWidth="10"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">
          {value === null ? "—" : `${Math.round(share * 100)} %`}
        </span>
        <span className="text-xs text-muted">{caption}</span>
      </div>
    </div>
  );
}
