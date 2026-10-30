import { AppStatusChip } from "@/components/ui";
import { DEFAULT_COLOR } from "@/config/colors";

/** Colored chip of a catalog category, or "Sin categoría". */
export function CategoryChip({
  category,
}: {
  category: { name: string; color: string } | null;
}) {
  if (!category) {
    return <AppStatusChip color={DEFAULT_COLOR} label="Sin categoría" />;
  }

  return <AppStatusChip color={category.color} label={category.name} />;
}
