import { Card } from "@heroui/react";
import clsx from "clsx";

export interface AppCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Anchor to link to the card, e.g. `/settings#general`. */
  id?: string;
}

export function AppCard({
  title,
  description,
  children,
  footer,
  className,
  id,
}: AppCardProps) {
  return (
    <Card className={clsx("w-full scroll-mt-6", className)} id={id}>
      {title || description ? (
        <Card.Header className="gap-1">
          {title ? (
            <Card.Title className="text-xl font-semibold tracking-tight">
              {title}
            </Card.Title>
          ) : null}
          {description ? (
            <Card.Description>{description}</Card.Description>
          ) : null}
        </Card.Header>
      ) : null}
      {children ? (
        <Card.Content className="flex flex-col gap-5">{children}</Card.Content>
      ) : null}
      {footer ? (
        <Card.Footer className="justify-center text-sm text-muted">
          {footer}
        </Card.Footer>
      ) : null}
    </Card>
  );
}
