"use client";

import { Tooltip } from "@heroui/react";

export interface AppTooltipProps {
  /** Shown on hover and keyboard focus; usually a short text. */
  content: React.ReactNode;
  /** A focusable trigger, usually an icon-only `AppButton`. */
  children: React.ReactNode;
  placement?: "top" | "right";
  /**
   * Wraps a trigger that is not a HeroUI button, such as a link. The wrapper
   * only listens to hover; the link keeps its own focus and `aria-label`.
   */
  wrapTrigger?: boolean;
}

/** Short hint for icon-only buttons; the button keeps its own `aria-label`. */
export function AppTooltip({
  content,
  children,
  placement = "top",
  wrapTrigger,
}: AppTooltipProps) {
  return (
    <Tooltip delay={300}>
      {wrapTrigger ? (
        <Tooltip.Trigger role="presentation" tabIndex={-1}>
          {children}
        </Tooltip.Trigger>
      ) : (
        children
      )}
      <Tooltip.Content placement={placement}>{content}</Tooltip.Content>
    </Tooltip>
  );
}
