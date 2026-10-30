"use client";

import { Suspense, useState } from "react";
import NextLink from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

import {
  type NavChild,
  type NavItem,
  navSections,
} from "@/components/app-shell/nav-config";
import { ChevronDownIcon } from "@/components/icons";
import { AppChip, AppTooltip } from "@/components/ui";
import { useMyAccess, usePermission } from "@/hooks/use-organization";
import { includesPermissions } from "@/lib/permissions";

function isUnder(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Index of the child that matches the current URL: its `match` pattern, or
 * the same path with every query param of its href. The most specific match
 * wins; if none matches on the parent's own page, the first child is active.
 */
function activeChildIndex(
  children: NavChild[],
  parentHref: string,
  pathname: string,
  searchParams: URLSearchParams,
) {
  let best = -1;
  let bestScore = -1;

  const patternIndex = children.findIndex((child) =>
    child.match?.test(pathname),
  );

  if (patternIndex !== -1) return patternIndex;

  children.forEach((child, index) => {
    if (child.href.includes("#") || child.match) return;
    const url = new URL(child.href, "http://local");

    if (url.pathname !== pathname) return;
    const params = [...url.searchParams.entries()];

    if (!params.every(([key, value]) => searchParams.get(key) === value)) {
      return;
    }
    if (params.length > bestScore) {
      best = index;
      bestScore = params.length;
    }
  });

  // On the parent page, a child without params only wins if no other param is
  // set (e.g. "Todos" is not active while filtering by owner).
  if (best !== -1 && bestScore === 0) {
    const siblingKeys = children.flatMap((child) => [
      ...new URL(child.href, "http://local").searchParams.keys(),
    ]);

    if (siblingKeys.some((key) => searchParams.has(key))) return -1;
  }

  if (best === -1 && pathname === parentHref && children.length) {
    const firstHasParams = new URL(children[0].href, "http://local").search;

    return firstHasParams ? 0 : -1;
  }

  return best;
}

const itemClass = (isActive: boolean) =>
  clsx(
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-accent/10 font-medium text-accent"
      : "text-muted hover:bg-default hover:text-foreground",
  );

function SubNav({
  item,
  items,
  onNavigate,
  withActiveState,
}: {
  item: NavItem;
  items: NavChild[];
  onNavigate?: () => void;
  withActiveState?: { pathname: string; searchParams: URLSearchParams };
}) {
  const activeIndex = withActiveState
    ? activeChildIndex(
        items,
        item.href,
        withActiveState.pathname,
        withActiveState.searchParams,
      )
    : -1;

  return (
    <ul className="ml-5 flex flex-col gap-0.5 border-l border-separator py-1 pl-3">
      {items.map((child, index) => {
        const isActive = index === activeIndex;

        return (
          <li key={child.href}>
            <NextLink
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted hover:bg-default hover:text-foreground",
              )}
              href={child.href}
              onClick={onNavigate}
            >
              <span className="truncate">{child.label}</span>
            </NextLink>
          </li>
        );
      })}
    </ul>
  );
}

/** Reads the search params, so it must render inside a Suspense boundary. */
function SubNavWithActiveState(props: {
  item: NavItem;
  items: NavChild[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <SubNav
      {...props}
      withActiveState={{
        pathname,
        searchParams: new URLSearchParams(searchParams.toString()),
      }}
    />
  );
}

function NavGroup({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: access } = useMyAccess();
  const isAllowed = usePermission(item.permission ?? {});
  const isActive = isUnder(pathname, item.href);
  // null follows the route: open while inside the module, closed elsewhere.
  const [isOpenOverride, setIsOpenOverride] = useState<boolean | null>(null);
  const Icon = item.icon;

  if (item.permission && !isAllowed) return null;

  if (item.isSoon) {
    return (
      <span
        aria-disabled
        className={clsx(
          itemClass(false),
          "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted",
        )}
      >
        <Icon size={18} />
        <span className="flex-1">{item.label}</span>
        <AppChip>Pronto</AppChip>
      </span>
    );
  }

  const children = (item.children ?? []).filter(
    (child) =>
      !child.permission ||
      (access
        ? includesPermissions(access.permissions, child.permission)
        : false),
  );

  if (!children.length) {
    return (
      <NextLink
        aria-current={isActive ? "page" : undefined}
        className={itemClass(isActive)}
        href={item.href}
        onClick={onNavigate}
      >
        <Icon size={18} />
        {item.label}
      </NextLink>
    );
  }

  const isOpen = isOpenOverride ?? isActive;
  const groupId = `nav-group-${item.href.replace(/\W/g, "")}`;

  return (
    <div className="flex flex-col">
      {/* The parent only toggles its group; the active child carries the highlight. */}
      <button
        aria-controls={groupId}
        aria-expanded={isOpen}
        className={clsx(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-default hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent",
          isActive ? "font-medium text-foreground" : "text-muted",
        )}
        type="button"
        onClick={() => setIsOpenOverride(!isOpen)}
      >
        <Icon size={18} />
        <span className="flex-1">{item.label}</span>
        <ChevronDownIcon
          className={clsx("transition-transform", !isOpen && "-rotate-90")}
          size={16}
        />
      </button>
      {isOpen ? (
        <div id={groupId}>
          <Suspense
            fallback={
              <SubNav item={item} items={children} onNavigate={onNavigate} />
            }
          >
            <SubNavWithActiveState
              item={item}
              items={children}
              onNavigate={onNavigate}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}

/** Icon-only entry of the collapsed sidebar; groups link to their parent page. */
function CollapsedNavItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isAllowed = usePermission(item.permission ?? {});
  const Icon = item.icon;

  if (item.permission && !isAllowed) return null;

  const itemClassName = (isActive: boolean) =>
    clsx(
      "flex size-10 items-center justify-center rounded-xl transition-colors",
      isActive
        ? "bg-accent/10 text-accent"
        : "text-muted hover:bg-default hover:text-foreground",
    );

  if (item.isSoon) {
    return (
      <AppTooltip
        wrapTrigger
        content={`${item.label} (pronto)`}
        placement="right"
      >
        <span
          aria-disabled
          aria-label={`${item.label} (pronto)`}
          className={clsx(
            itemClassName(false),
            "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted",
          )}
        >
          <Icon size={18} />
        </span>
      </AppTooltip>
    );
  }

  const isActive = isUnder(pathname, item.href);

  return (
    <AppTooltip wrapTrigger content={item.label} placement="right">
      <NextLink
        aria-current={isActive ? "page" : undefined}
        aria-label={item.label}
        className={itemClassName(isActive)}
        href={item.href}
      >
        <Icon size={18} />
      </NextLink>
    </AppTooltip>
  );
}

export function SidebarNav({
  onNavigate,
  isCollapsed,
}: {
  onNavigate?: () => void;
  isCollapsed?: boolean;
}) {
  if (isCollapsed) {
    return (
      <nav
        aria-label="Navegación principal"
        className="flex flex-col items-center gap-3"
      >
        {navSections.map((section, index) => (
          <div
            key={section.label ?? index}
            className={clsx(
              "flex flex-col items-center gap-1",
              index > 0 && "border-t border-separator pt-3",
            )}
          >
            {section.items.map((item) => (
              <CollapsedNavItem key={item.href} item={item} />
            ))}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-6">
      {navSections.map((section, index) => (
        <div key={section.label ?? index} className="flex flex-col gap-1">
          {section.label ? (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => (
            <NavGroup key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
