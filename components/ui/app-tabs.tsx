"use client";

import { Tabs } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { RouterProvider } from "react-aria-components";

export interface AppTabItem {
  label: string;
  /** Route of the tab; it stays selected on its nested paths too. */
  href: string;
  icon?: React.FC<{ size?: number }>;
  /** Number shown after the label, e.g. how many photos. */
  count?: number;
}

export interface AppTabsProps {
  "aria-label": string;
  items: AppTabItem[];
  /** Content of the active route, usually a layout's `children`. */
  children: React.ReactNode;
}

const isUnder = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Page-level tabs where each tab is a route: a compact list aligned to the start. */
export function AppTabs({
  "aria-label": ariaLabel,
  items,
  children,
}: AppTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  // The most specific route wins, so a tab at `/x` doesn't shadow `/x/y`.
  const selected = items
    .filter((item) => isUnder(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      <Tabs className="w-full" selectedKey={selected?.href ?? ""}>
        <Tabs.ListContainer className="max-w-full self-start overflow-x-auto">
          <Tabs.List aria-label={ariaLabel}>
            {items.map(({ label, href, icon: Icon, count }) => (
              <Tabs.Tab
                key={href}
                className="gap-2 whitespace-nowrap"
                href={href}
                id={href}
              >
                {Icon ? <Icon size={16} /> : null}
                {label}
                {count !== undefined ? (
                  <span className="rounded-full bg-default px-1.5 text-xs text-muted tabular-nums">
                    {count}
                  </span>
                ) : null}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {selected ? (
          <Tabs.Panel className="pt-4" id={selected.href}>
            {children}
          </Tabs.Panel>
        ) : (
          children
        )}
      </Tabs>
    </RouterProvider>
  );
}
