import { AppChip } from "@/components/ui";

export function CatalogActiveChip({ isActive }: { isActive: boolean }) {
  return (
    <AppChip color={isActive ? "success" : "default"}>
      {isActive ? "Activo" : "Inactivo"}
    </AppChip>
  );
}
