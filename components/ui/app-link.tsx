import NextLink from "next/link";
import clsx from "clsx";

import { ExternalLinkIcon } from "@/components/icons";

export interface AppLinkProps {
  href: string;
  children: React.ReactNode;
  size?: "xs" | "sm";
  className?: string;
  /** Opens in a new tab, e.g. to look something up without leaving a form. */
  newTab?: boolean;
}

export function AppLink({
  href,
  children,
  size = "sm",
  className,
  newTab,
}: AppLinkProps) {
  return (
    <NextLink
      className={clsx(
        "font-medium text-accent underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none",
        size === "xs" ? "text-xs" : "text-sm",
        className,
      )}
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </NextLink>
  );
}

export interface AppIconLinkProps {
  href: string;
  /** Accessible name and tooltip of the icon, e.g. "Ver ficha". */
  label: string;
}

/**
 * Small icon that opens a record in a new tab, placed right after its name,
 * so the current screen (a form, the till's cart) is not lost.
 */
export function AppIconLink({ href, label }: AppIconLinkProps) {
  return (
    <NextLink
      aria-label={label}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-default hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      title={label}
    >
      <ExternalLinkIcon size={14} />
    </NextLink>
  );
}
