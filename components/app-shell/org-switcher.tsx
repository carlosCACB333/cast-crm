"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { ChevronUpDownIcon, PlusIcon } from "@/components/icons";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import {
  AppAvatar,
  AppButton,
  AppChip,
  AppDropdown,
  AppModal,
  AppSkeleton,
  notify,
} from "@/components/ui";
import {
  useActiveOrganization,
  useCanCreateOrganization,
  useOrganizations,
} from "@/hooks/use-organization";
import { setActiveOrganization } from "@/lib/actions/organization";
import { roleColor } from "@/components/organization/role";

const CREATE_KEY = "__create__";

export function OrgSwitcher({ isCollapsed }: { isCollapsed?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: organizations } = useOrganizations();
  const { data: active, isPending } = useActiveOrganization();
  const { data: canCreate } = useCanCreateOrganization();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (isPending) {
    return (
      <AppSkeleton
        className={
          isCollapsed ? "size-10 rounded-xl" : "h-12 w-full rounded-xl"
        }
      />
    );
  }

  const handleAction = async (id: string) => {
    if (id === CREATE_KEY) {
      setIsCreateOpen(true);

      return;
    }
    if (id === active?.id) return;

    const result = await setActiveOrganization(id);

    if (!result.ok) {
      notify.error(result.error);

      return;
    }

    await queryClient.invalidateQueries();
    router.refresh();
  };

  const name = active?.name ?? "Sin organización";
  const activeMembership = organizations?.find(
    (organization) => organization.id === active?.id,
  );

  return (
    <>
      <AppDropdown
        items={[
          ...(organizations ?? []).map((organization) => ({
            id: organization.id,
            label: organization.name,
            badge: (
              <AppChip color={roleColor(organization.role)}>
                {organization.roleLabel}
              </AppChip>
            ),
            isSelected: organization.id === active?.id,
          })),
          ...(canCreate
            ? [
                {
                  id: CREATE_KEY,
                  label: "Crear organización",
                  icon: <PlusIcon size={16} />,
                },
              ]
            : []),
        ]}
        label="Cambiar de organización"
        placement={isCollapsed ? "right" : "bottom start"}
        trigger={
          isCollapsed ? (
            <AppButton
              isIconOnly
              aria-label={`Organización activa: ${name}. Cambiar de organización`}
              variant="ghost"
            >
              <AppAvatar
                color="accent"
                name={name}
                size="sm"
                src={active?.logo}
              />
            </AppButton>
          ) : (
            <AppButton
              fullWidth
              aria-label={`Organización activa: ${name}. Cambiar de organización`}
              className="h-auto justify-start gap-3 p-2"
              size="sm"
              variant="outline"
            >
              <AppAvatar color="accent" name={name} src={active?.logo} />
              <span className="flex min-w-0 flex-1  items-start gap-1 text-left">
                <span className="w-full truncate text-sm font-semibold">
                  {name}
                </span>
                {activeMembership ? (
                  <AppChip color={roleColor(activeMembership.role)}>
                    {activeMembership.roleLabel}
                  </AppChip>
                ) : null}
              </span>
              <ChevronUpDownIcon className="text-muted" size={16} />
            </AppButton>
          )
        }
        onAction={handleAction}
      />
      <AppModal
        description="Cada organización tiene sus propios datos, miembros y permisos."
        isOpen={isCreateOpen}
        title="Nueva organización"
        onOpenChange={setIsCreateOpen}
      >
        <CreateOrganizationForm
          onCreated={() => {
            setIsCreateOpen(false);
            router.refresh();
          }}
        />
      </AppModal>
    </>
  );
}
