import { Skeleton } from "@heroui/react";

export function AppSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className ?? "h-4 w-full rounded-lg"} />;
}
