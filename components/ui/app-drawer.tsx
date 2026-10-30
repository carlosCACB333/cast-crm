"use client";

import { Drawer } from "@heroui/react";
import clsx from "clsx";

export interface AppDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  label: string;
  placement?: "left" | "right";
  /** `nav` for the mobile navigation, `panel` for forms and side content. */
  size?: "nav" | "panel";
  /** Heading of a panel; navigation drawers render their own content. */
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AppDrawer({
  isOpen,
  onOpenChange,
  label,
  placement = "left",
  size = "nav",
  title,
  description,
  footer,
  children,
}: AppDrawerProps) {
  const isPanel = size === "panel";

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement={placement}>
        <Drawer.Dialog
          aria-label={label}
          className={clsx(
            isPanel
              ? "flex w-full flex-col sm:max-w-xl"
              : "w-72 max-w-[85vw] p-0",
          )}
        >
          <Drawer.CloseTrigger />
          {title ? (
            <Drawer.Header className="flex flex-col items-start gap-1">
              <Drawer.Heading>{title}</Drawer.Heading>
              {description ? (
                <p className="text-sm text-muted">{description}</p>
              ) : null}
            </Drawer.Header>
          ) : null}
          {/* Navigation content starts below the floating close button so its
              first control (the org switcher) never sits under it. */}
          <Drawer.Body
            className={isPanel ? "flex-1 overflow-y-auto" : "p-0 pt-10"}
          >
            {children}
          </Drawer.Body>
          {footer ? (
            <Drawer.Footer className="flex justify-end gap-2">
              {footer}
            </Drawer.Footer>
          ) : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
