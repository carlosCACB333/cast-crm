import NextLink from "next/link";
import clsx from "clsx";

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
