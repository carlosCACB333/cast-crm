import { Avatar } from "@heroui/react";

export interface AppAvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  color?: "accent" | "danger" | "default" | "success" | "warning" | undefined;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppAvatar({
  name,
  src,
  size = "md",
  className,
  color = "default",
}: AppAvatarProps) {
  return (
    <Avatar className={className} color={color} size={size}>
      {src ? <Avatar.Image alt={name} src={src} /> : null}
      <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
    </Avatar>
  );
}
