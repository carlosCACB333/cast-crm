import { Chip } from "@heroui/react";

export interface AppChipProps {
  children: React.ReactNode;
  color?: "default" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md";
}

export function AppChip({
  children,
  color = "default",
  size = "sm",
}: AppChipProps) {
  return (
    <Chip color={color} size={size} variant="soft">
      {children}
    </Chip>
  );
}
