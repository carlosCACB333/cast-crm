import { Separator } from "@heroui/react";

export interface AppDividerProps {
  label?: string;
}

export function AppDivider({ label }: AppDividerProps) {
  if (!label) return <Separator />;

  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
      <Separator className="flex-1" />
      {label}
      <Separator className="flex-1" />
    </div>
  );
}
