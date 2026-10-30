import { PackageIcon } from "@/components/icons";
import { CatalogThumb } from "@/components/catalog/catalog-thumb";
import { AppChip } from "@/components/ui";
import { APP_LOCALE } from "@/config/organization";
import { unitInfo } from "@/config/products";

export { dateTimeFormatter, formatRelative } from "@/lib/format";
export { formatPercent, priceMargin, priceWithTax } from "@/lib/pricing";
export { CategoryChip } from "@/components/catalog/category-chip";
export { CatalogActiveChip } from "@/components/catalog/catalog-active-chip";

const quantityFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 3,
});

/** "12 ud.", "2,5 kg". */
export function formatQuantity(value: number, unit: string) {
  return `${quantityFormatter.format(value)} ${unitInfo(unit).short}`;
}

export type StockLevel = "untracked" | "out" | "low" | "ok";

export function stockLevel(product: {
  trackStock: boolean;
  stock: number;
  minStock: number | null;
}): StockLevel {
  if (!product.trackStock) return "untracked";
  if (product.stock <= 0) return "out";
  if (product.minStock !== null && product.stock <= product.minStock) {
    return "low";
  }

  return "ok";
}

const LEVEL_CHIPS = {
  ok: { color: "success", label: "Disponible" },
  low: { color: "warning", label: "Stock bajo" },
  out: { color: "danger", label: "Sin stock" },
} as const;

export function StockLevelChip({
  level,
}: {
  level: Exclude<StockLevel, "untracked">;
}) {
  const chip = LEVEL_CHIPS[level];

  return <AppChip color={chip.color}>{chip.label}</AppChip>;
}

/** Stock with its unit, colored when it is low or exhausted. */
export function StockBadge({
  product,
}: {
  product: {
    trackStock: boolean;
    stock: number;
    minStock: number | null;
    unit: string;
  };
}) {
  const level = stockLevel(product);

  if (level === "untracked") {
    return <span className="text-sm text-muted">Sin control</span>;
  }

  const quantity = formatQuantity(product.stock, product.unit);

  if (level === "ok") {
    return <span className="text-sm tabular-nums">{quantity}</span>;
  }

  return (
    <span className="flex flex-col items-start gap-0.5">
      <StockLevelChip level={level} />
      {level === "low" ? (
        <span className="text-xs text-muted tabular-nums">{quantity}</span>
      ) : null}
    </span>
  );
}

/** Thumbnail of a product, tinted with its category color. */
export function ProductThumb(props: {
  name: string;
  color?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "lg";
}) {
  return <CatalogThumb {...props} icon={PackageIcon} />;
}
