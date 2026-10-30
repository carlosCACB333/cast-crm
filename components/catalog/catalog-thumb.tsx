import clsx from "clsx";

import { AppImage } from "@/components/ui";
import { DEFAULT_COLOR } from "@/config/colors";
import { APP_LOCALE } from "@/config/organization";

/**
 * Square tile with the item photo or, without one, its initial tinted with
 * the category color.
 */
export function CatalogThumb({
  name,
  icon: Icon,
  color,
  imageUrl,
  size = "sm",
}: {
  name: string;
  /** Icon of the module, shown in the corner badge. */
  icon: React.FC<{ size?: number }>;
  color?: string | null;
  /** Main photo; replaces the initial. */
  imageUrl?: string | null;
  size?: "sm" | "lg";
}) {
  const tint = color ?? DEFAULT_COLOR;

  return (
    <span
      aria-hidden
      className={clsx(
        "relative flex shrink-0 items-center justify-center rounded-xl font-semibold",
        size === "lg" ? "size-14 text-xl" : "size-9 text-sm",
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`,
        color: `color-mix(in oklab, ${tint} 70%, var(--foreground))`,
      }}
    >
      {imageUrl ? (
        <span className="absolute inset-0 overflow-hidden rounded-xl">
          <AppImage
            alt=""
            sizes={size === "lg" ? "56px" : "36px"}
            src={imageUrl}
          />
        </span>
      ) : (
        name.trim().charAt(0).toLocaleUpperCase(APP_LOCALE) || (
          <Icon size={size === "lg" ? 22 : 16} />
        )
      )}
      <span
        className={clsx(
          "absolute -right-1 -bottom-1 flex items-center justify-center rounded-full bg-surface text-muted shadow-sm",
          size === "lg" ? "size-6" : "size-4",
        )}
      >
        <Icon size={size === "lg" ? 14 : 10} />
      </span>
    </span>
  );
}
