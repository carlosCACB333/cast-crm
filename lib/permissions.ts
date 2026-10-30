import { createAccessControl } from "better-auth/plugins/access";

/**
 * Resources and actions that roles can grant, as `resource:action`.
 * Each CRM module adds its own resource here (e.g. `contact: ["read", "create", "update", "delete"]`)
 * plus its labels below; it then shows up in the role editor automatically.
 */
export const statements = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],
  customer: ["read", "create", "update", "delete"],
  lead: ["read", "create", "update", "delete"],
  pipeline: ["manage"],
  product: ["read", "create", "update", "delete"],
  service: ["read", "create", "update", "delete"],
  sale: ["read", "create", "update", "delete"],
  pos: ["read", "sell", "manage"],
} as const;

export type Resource = keyof typeof statements;
export type Action<R extends Resource = Resource> =
  (typeof statements)[R][number];

export type Permissions = { [R in Resource]?: Action<R>[] };

export const ac = createAccessControl(statements);

/** The organization creator. Fixed role with full access to every resource. */
export const OWNER_ROLE = "owner";

const allPermissions = Object.fromEntries(
  Object.entries(statements).map(([resource, actions]) => [
    resource,
    [...actions],
  ]),
) as Required<Permissions>;

/** Static roles. Every other role is created per organization (dynamic access control). */
export const roles = {
  [OWNER_ROLE]: ac.newRole(allPermissions),
};

export const RESOURCE_LABELS: Record<
  Resource,
  { label: string; description: string }
> = {
  organization: {
    label: "Organización",
    description: "Datos generales de la organización",
  },
  member: {
    label: "Miembros",
    description: "Personas con acceso a la organización",
  },
  invitation: {
    label: "Invitaciones",
    description: "Invitar a nuevas personas",
  },
  ac: {
    label: "Roles y permisos",
    description: "Definir roles y sus permisos",
  },
  customer: {
    label: "Clientes",
    description: "Fichas de clientes, sus notas y su exportación",
  },
  lead: {
    label: "Leads",
    description: "Oportunidades en los tableros kanban y sus notas",
  },
  pipeline: {
    label: "Embudos",
    description: "Crear tableros de leads y definir sus pasos",
  },
  product: {
    label: "Productos",
    description: "Catálogo de productos, precios y stock",
  },
  service: {
    label: "Servicios",
    description: "Catálogo de servicios y sus precios",
  },
  sale: {
    label: "Ventas",
    description: "Presupuestos, pedidos, albaranes, facturas y sus cobros",
  },
  pos: {
    label: "Punto de venta",
    description:
      "Ver aperturas de caja, vender en el TPV y gestionar las cajas de todo el equipo",
  },
};

export const ACTION_LABELS: Record<string, string> = {
  read: "Ver",
  create: "Crear",
  update: "Editar",
  delete: "Eliminar",
  cancel: "Cancelar",
  manage: "Gestionar",
  sell: "Vender",
};

/** Roles created with every new organization. They can be edited or deleted later. */
export const DEFAULT_ROLES: {
  role: string;
  label: string;
  description: string;
  permission: Permissions;
}[] = [
  {
    role: "admin",
    label: "Administrador",
    description: "Gestiona la organización, sus miembros y sus roles",
    permission: {
      organization: ["update"],
      member: ["create", "update", "delete"],
      invitation: ["create", "cancel"],
      ac: ["create", "read", "update", "delete"],
      customer: ["read", "create", "update", "delete"],
      lead: ["read", "create", "update", "delete"],
      pipeline: ["manage"],
      product: ["read", "create", "update", "delete"],
      service: ["read", "create", "update", "delete"],
      sale: ["read", "create", "update", "delete"],
      pos: ["read", "sell", "manage"],
    },
  },
  {
    role: "member",
    label: "Miembro",
    description: "Trabaja con los datos de la organización",
    permission: {
      customer: ["read", "create", "update"],
      lead: ["read", "create", "update"],
      product: ["read", "create", "update"],
      service: ["read", "create", "update"],
      sale: ["read", "create", "update"],
      pos: ["read", "sell"],
    },
  },
];

/** Merges several permission maps (e.g. from multiple roles). */
export function mergePermissions(...maps: Permissions[]): Permissions {
  const merged: Record<string, Set<string>> = {};

  for (const map of maps) {
    for (const [resource, actions] of Object.entries(map)) {
      merged[resource] ??= new Set();
      for (const action of actions ?? []) merged[resource].add(action);
    }
  }

  return Object.fromEntries(
    Object.entries(merged).map(([resource, actions]) => [
      resource,
      [...actions],
    ]),
  ) as Permissions;
}

/** Whether `granted` includes every action in `required`. */
export function includesPermissions(
  granted: Permissions,
  required: Permissions,
) {
  return Object.entries(required).every(([resource, actions]) =>
    (actions ?? []).every((action) =>
      (granted[resource as Resource] as string[] | undefined)?.includes(action),
    ),
  );
}

export function ownerPermissions(): Permissions {
  return allPermissions;
}
