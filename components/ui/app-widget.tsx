import { Card } from "@heroui/react";
import NextLink from "next/link";
import clsx from "clsx";

import { ChevronRightIcon } from "@/components/icons";

export interface AppWidgetProps {
  title: string;
  icon: React.ReactNode;
  description?: React.ReactNode;
  /** Page with the full data behind the widget. */
  href?: string;
  children: React.ReactNode;
  className?: string;
}

/** Dashboard block: icon, title and a "Ver todo" link above its content. */
export function AppWidget({
  title,
  icon,
  description,
  href,
  children,
  className,
}: AppWidgetProps) {
  return (
    <Card className={clsx("w-full gap-4", className)}>
      <Card.Header className="flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Card.Title className="text-base font-semibold leading-tight">
            {title}
          </Card.Title>
          {description ? (
            <Card.Description className="text-xs">
              {description}
            </Card.Description>
          ) : null}
        </div>
        {href ? (
          <NextLink
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/10 py-1 pr-2 pl-3 text-xs font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-accent"
            href={href}
          >
            Ver todo
            <ChevronRightIcon size={14} />
          </NextLink>
        ) : null}
      </Card.Header>
      <Card.Content className="flex flex-1 flex-col gap-4">
        {children}
      </Card.Content>
    </Card>
  );
}
