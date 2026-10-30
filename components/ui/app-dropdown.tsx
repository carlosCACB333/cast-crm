"use client";

import { Dropdown, Label } from "@heroui/react";

export interface AppDropdownItem {
  id: string;
  label: string;
  description?: string;
  /** Small element shown at the end of the item, e.g. an AppChip. */
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  isDanger?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
}

export interface AppDropdownProps {
  /** Pressable element (e.g. an AppButton) that opens the menu. */
  trigger: React.ReactNode;
  items: AppDropdownItem[];
  label: string;
  header?: React.ReactNode;
  placement?: "bottom start" | "bottom end" | "top start" | "top end" | "right";
  onAction: (id: string) => void;
}

export function AppDropdown({
  trigger,
  items,
  label,
  header,
  placement = "bottom end",
  onAction,
}: AppDropdownProps) {
  return (
    <Dropdown>
      {trigger}
      <Dropdown.Popover className="min-w-56" placement={placement}>
        {header ? <div className="px-3 pt-3 pb-1">{header}</div> : null}
        <Dropdown.Menu
          aria-label={label}
          disabledKeys={items
            .filter((item) => item.isDisabled)
            .map((item) => item.id)}
          onAction={(key) => onAction(String(key))}
        >
          {items.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              textValue={item.label}
              variant={item.isDanger ? "danger" : "default"}
            >
              {item.icon ? (
                <span className="flex size-4 items-center justify-center text-muted">
                  {item.icon}
                </span>
              ) : null}
              <div className="flex flex-1 flex-col">
                <Label>{item.label}</Label>
                {item.description ? (
                  <span className="text-xs text-muted">{item.description}</span>
                ) : null}
              </div>
              {item.badge}
              {item.isSelected ? <span className="text-accent">✓</span> : null}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
