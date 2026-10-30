/**
 * Product configuration of the dashboard. Shared by every organization; the
 * data shown comes from each organization's own modules.
 */

export const DASHBOARD_CONFIG = {
  /** Months covered by the trend charts, including the current one. */
  trendMonths: 6,
  /** How long the aggregates stay fresh before being fetched again (ms). */
  staleTime: 60_000,
};
