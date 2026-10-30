import { CatalogThumb } from "@/components/catalog/catalog-thumb";
import { BriefcaseIcon } from "@/components/icons";

export { dateTimeFormatter, formatRelative } from "@/lib/format";
export { formatPercent, priceWithTax } from "@/lib/pricing";
export { CategoryChip } from "@/components/catalog/category-chip";
export { CatalogActiveChip } from "@/components/catalog/catalog-active-chip";

/** "45 min", "2 h", "1 h 30 min". */
export function formatDuration(minutes: number | null) {
  if (!minutes) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (!hours) return `${rest} min`;

  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Thumbnail of a service, tinted with its category color. */
export function ServiceThumb(props: {
  name: string;
  color?: string | null;
  size?: "sm" | "lg";
}) {
  return <CatalogThumb {...props} icon={BriefcaseIcon} />;
}
