import type { Permissions } from "@/lib/permissions";

import {
  BriefcaseIcon,
  CartIcon,
  ContactsIcon,
  HomeIcon,
  PackageIcon,
  SettingsIcon,
  ShieldIcon,
  StoreIcon,
  TargetIcon,
  TasksIcon,
  UsersIcon,
} from "@/components/icons";
import { SALES_TYPE_LIST } from "@/config/sales";

export interface NavItem {
  label: string;
  href: string;
  icon: React.FC<{ size?: number }>;
  /** Required permission to show the item. The page enforces it again on the server. */
  permission?: Permissions;
  /** Module not available yet: rendered disabled. */
  isSoon?: boolean;
  /** Sub-items shown in a collapsible group under the item. */
  children?: NavChild[];
}

export interface NavChild {
  label: string;
  /** Query params in the href (e.g. `?ownerId=me`) are part of the match. */
  href: string;
  permission?: Permissions;
  /**
   * Paths where the item is active when they differ from its href, e.g. a
   * menu entry that redirects to a page with an id.
   */
  match?: RegExp;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [{ label: "Panel", href: "/dashboard", icon: HomeIcon }],
  },
  {
    label: "CRM",
    items: [
      {
        label: "Clientes",
        href: "/customers",
        icon: ContactsIcon,
        permission: { customer: ["read"] },
        children: [
          {
            // Filters and customer details live under the list, so it stays active there too.
            label: "Listado",
            href: "/customers",
            match: /^\/customers(?!\/statuses$)(\/.*)?$/,
          },
          {
            label: "Estados",
            href: "/customers/statuses",
          },
        ],
      },
      {
        label: "Leads",
        href: "/leads",
        icon: TargetIcon,
        permission: { lead: ["read"] },
        children: [
          {
            // Boards (/leads/pipelines/[id]/kanban) and leads are opened from a
            // pipeline, so it stays active there too.
            label: "Tablero",
            href: "/leads",
            match: /^\/leads(?!\/pipelines$)(\/.*)?$/,
          },
          {
            label: "Embudos",
            href: "/leads/pipelines",
            permission: { pipeline: ["manage"] },
          },
        ],
      },
      {
        label: "Productos",
        href: "/products",
        icon: PackageIcon,
        permission: { product: ["read"] },
        children: [
          {
            // Product details live under the catalog, so it stays active there
            // too, except on the creation page, which has its own entry.
            label: "Catálogo",
            href: "/products",
            match: /^\/products(?!\/new$|\/categories$)(\/.*)?$/,
          },
          {
            label: "Nuevo producto",
            href: "/products/new",
            permission: { product: ["create"] },
            match: /^\/products\/new$/,
          },
          {
            label: "Categorías",
            href: "/products/categories",
          },
        ],
      },
      {
        label: "Servicios",
        href: "/services",
        icon: BriefcaseIcon,
        permission: { service: ["read"] },
        children: [
          {
            // Service details live under the catalog, so it stays active there
            // too, except on the creation page, which has its own entry.
            label: "Catálogo",
            href: "/services",
            match: /^\/services(?!\/new$|\/categories$)(\/.*)?$/,
          },
          {
            label: "Nuevo servicio",
            href: "/services/new",
            permission: { service: ["create"] },
            match: /^\/services\/new$/,
          },
          {
            label: "Categorías",
            href: "/services/categories",
          },
        ],
      },
      {
        label: "Ventas",
        href: "/sales",
        icon: CartIcon,
        permission: { sale: ["read"] },
        children: [
          { label: "Resumen", href: "/sales", match: /^\/sales$/ },
          // Each list stays active on its documents and their forms.
          ...SALES_TYPE_LIST.map((definition) => ({
            label: definition.plural,
            href: `/sales/${definition.slug}`,
            match: new RegExp(`^/sales/${definition.slug}(/.*)?$`),
          })),
          { label: "Formas de pago", href: "/sales/payment-methods" },
          { label: "Configuración", href: "/sales/settings" },
        ],
      },
      {
        label: "Punto de venta",
        href: "/pos",
        icon: StoreIcon,
        permission: { pos: ["read"] },
        children: [
          {
            label: "Vender",
            href: "/pos",
            permission: { pos: ["sell"] },
            match: /^\/pos$/,
          },
          {
            // Each session's detail lives under the list.
            label: "Aperturas de caja",
            href: "/pos/sessions",
            match: /^\/pos\/sessions(\/.*)?$/,
          },
          { label: "Cajas", href: "/pos/registers" },
          { label: "Configuración", href: "/pos/settings" },
        ],
      },
      { label: "Tareas", href: "/tasks", icon: TasksIcon, isSoon: true },
    ],
  },
  {
    label: "Organización",
    items: [
      { label: "Miembros", href: "/members", icon: UsersIcon },
      {
        label: "Roles",
        href: "/roles",
        icon: ShieldIcon,
        permission: { ac: ["read"] },
      },
      // Module settings (statuses, pipelines, categories) live in their
      // module; this page holds the organization-wide ones.
      { label: "Configuración", href: "/settings", icon: SettingsIcon },
    ],
  },
];
