"use client";

import { AppAlert, AppButton, AppSkeleton } from "@/components/ui";

export function QueryError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <AppAlert
        description={error.message}
        status="danger"
        title="No se pudieron cargar los datos"
      />
      <AppButton size="sm" variant="secondary" onPress={onRetry}>
        Reintentar
      </AppButton>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <AppSkeleton key={index} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}
