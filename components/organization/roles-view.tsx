"use client";

import { useState } from "react";

import { MoreIcon, PlusIcon } from "@/components/icons";
import { QueryError } from "@/components/organization/query-state";
import {
  type EditableRole,
  RoleFormModal,
} from "@/components/organization/role-form-modal";
import { PageHeader } from "@/components/page-header";
import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppConfirm,
  AppDataTable,
  AppDropdown,
  type AppDropdownItem,
} from "@/components/ui";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useListParams } from "@/hooks/use-list-params";
import {
  useMyAccess,
  usePermission,
  useRolePage,
} from "@/hooks/use-organization";
import { type OrganizationRoleItem, deleteRole } from "@/lib/actions/roles";
import {
  ROLE_TYPES,
  type RoleListParams,
  roleListSchema,
} from "@/lib/validations/roles";
import {
  ACTION_LABELS,
  type Permissions,
  RESOURCE_LABELS,
  type Resource,
} from "@/lib/permissions";

type RoleItem = OrganizationRoleItem;
type Column = "role" | "permissions" | "members" | "actions";
type RoleType = (typeof ROLE_TYPES)[number];

const ROLE_TYPE_LABELS: Record<RoleType, string> = {
  system: "Sistema",
  custom: "Personalizado",
};

function PermissionSummary({ permission }: { permission: Permissions | null }) {
  const entries = Object.entries(permission ?? {}).filter(
    ([, actions]) => actions && actions.length > 0,
  );

  if (entries.length === 0) {
    return <span className="text-sm text-muted">Sin permisos de gestión</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([resource, actions]) => (
        <AppChip key={resource}>
          {RESOURCE_LABELS[resource as Resource]?.label ?? resource}:{" "}
          {(actions ?? [])
            .map((action) => ACTION_LABELS[action] ?? action)
            .join(", ")}
        </AppChip>
      ))}
    </div>
  );
}

export function RolesView() {
  const { isPending: isAccessPending } = useMyAccess();
  const canRead = usePermission({ ac: ["read"] });
  const canCreate = usePermission({ ac: ["create"] });
  const canUpdate = usePermission({ ac: ["update"] });
  const canDelete = usePermission({ ac: ["delete"] });
  const [editing, setEditing] = useState<EditableRole>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<RoleItem>();
  const remove = useActionMutation(deleteRole, {
    successMessage: "Rol eliminado",
  });
  const list = useListParams<RoleListParams>(roleListSchema.parse({}));
  const roles = useRolePage(list.params);
  const data = roles.data;

  const openForm = (role?: RoleItem) => {
    setEditing(
      role
        ? {
            id: role.id,
            label: role.label,
            description: role.description,
            permission: role.permission,
          }
        : undefined,
    );
    setIsFormOpen(true);
  };

  const roleItems = (role: RoleItem): AppDropdownItem[] => [
    ...(canUpdate ? [{ id: "edit", label: "Editar rol" }] : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar rol",
            isDanger: true,
            isDisabled: role.memberCount > 0,
            description:
              role.memberCount > 0 ? "Tiene miembros asignados" : undefined,
          },
        ]
      : []),
  ];

  if (!isAccessPending && !canRead) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Roles y permisos" />
        <AppAlert
          description="Pide a un propietario o administrador que te conceda el permiso “Roles y permisos: Ver”."
          status="danger"
          title="No tienes acceso a esta sección"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        actions={
          canCreate ? (
            <AppButton onPress={() => openForm()}>
              <PlusIcon size={16} />
              Nuevo rol
            </AppButton>
          ) : null
        }
        description="Crea roles con los permisos que necesita tu equipo y asígnalos en Miembros."
        title="Roles y permisos"
      />

      {roles.error ? (
        <QueryError error={roles.error} onRetry={() => roles.refetch()} />
      ) : (
        <AppCard title={`Roles${data ? ` (${data.total})` : ""}`}>
          <AppDataTable<RoleItem, Column>
            columns={[
              {
                key: "role",
                label: "Rol",
                isRowHeader: true,
                allowsSorting: true,
                filter: {
                  type: "options",
                  label: "Tipo",
                  multiple: true,
                  options: ROLE_TYPES.map((value) => ({
                    value,
                    label: ROLE_TYPE_LABELS[value],
                  })),
                  value: list.params.types,
                  onChange: (types) =>
                    list.setParams({ types: types as RoleType[] }),
                },
              },
              { key: "permissions", label: "Permisos", defaultWidth: "2fr" },
              {
                key: "members",
                label: "Miembros",
                defaultWidth: 120,
                allowsSorting: true,
              },
              {
                key: "actions",
                label: "Acciones",
                className: "text-right",
                width: 96,
              },
            ]}
            emptyContent="Aún no hay roles"
            getRowKey={(role) => role.id}
            label="Roles de la organización"
            pagination={list.pagination(data)}
            query={roles}
            renderCell={(role, column) => {
              switch (column) {
                case "role":
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2 font-medium">
                        {role.label}
                        {role.isSystem ? (
                          <AppChip color="accent">Sistema</AppChip>
                        ) : null}
                      </span>
                      {role.description ? (
                        <span className="text-xs text-muted">
                          {role.description}
                        </span>
                      ) : null}
                    </div>
                  );
                case "permissions":
                  return role.isSystem ? (
                    <span className="text-sm">Acceso total</span>
                  ) : (
                    <PermissionSummary permission={role.permission} />
                  );
                case "members":
                  return <span className="text-sm">{role.memberCount}</span>;
                case "actions": {
                  const items = role.isSystem ? [] : roleItems(role);

                  return items.length ? (
                    <AppDropdown
                      items={items}
                      label={`Acciones para ${role.label}`}
                      trigger={
                        <AppButton
                          isIconOnly
                          aria-label={`Acciones para ${role.label}`}
                          size="sm"
                          variant="ghost"
                        >
                          <MoreIcon size={16} />
                        </AppButton>
                      }
                      onAction={(id) =>
                        id === "edit" ? openForm(role) : setToDelete(role)
                      }
                    />
                  ) : null;
                }
              }
            }}
            rows={data?.items ?? []}
            search={{
              ...list.search,
              placeholder: "Buscar por nombre o descripción…",
            }}
            sort={list.sort}
            onClearFilters={list.onClearFilters}
            onSortChange={list.onSortChange}
          />
        </AppCard>
      )}

      <RoleFormModal
        isOpen={isFormOpen}
        role={editing}
        onOpenChange={setIsFormOpen}
      />
      <AppConfirm
        confirmLabel="Eliminar"
        description={`El rol “${toDelete?.label ?? ""}” se eliminará. Esta acción no se puede deshacer.`}
        isOpen={toDelete !== undefined}
        isPending={remove.isPending}
        title="Eliminar rol"
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(undefined),
          })
        }
        onOpenChange={(open) => !open && setToDelete(undefined)}
      />
    </div>
  );
}
