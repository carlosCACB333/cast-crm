import { APP_LOCALE } from "@/config/organization";

const relativeFormatter = new Intl.RelativeTimeFormat(APP_LOCALE, {
  numeric: "auto",
});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** "hace 3 días", "ayer", "ahora". */
export function formatRelative(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;

  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeFormatter.format(Math.round(seconds / size), unit);
    }
  }

  return "ahora";
}

export const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Formats an ISO timestamp as date and time. */
export const formatDateTime = (value: string) =>
  dateTimeFormatter.format(new Date(value));

export const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Formats a "YYYY-MM-DD" date without shifting it to the local timezone. */
export function formatDay(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

/** Whether a "YYYY-MM-DD" date is before today. */
export function isPastDay(value: string) {
  return value < new Date().toISOString().slice(0, 10);
}

const monthFormatter = new Intl.DateTimeFormat(APP_LOCALE, { month: "short" });

/** Short month name of a "YYYY-MM" month, e.g. "oct". */
export function formatMonth(value: string) {
  return monthFormatter.format(new Date(`${value}-01T12:00:00`));
}
