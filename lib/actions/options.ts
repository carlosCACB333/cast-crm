"use server";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import { Prisma } from "@/lib/generated/prisma/client";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { OPTION_DEFAULTS } from "@/config/tables";
import { APP_LOCALE } from "@/config/organization";
import { paymentMethodKindLabel } from "@/config/payment-methods";
import { POS_LOADABLE_STATUSES } from "@/config/pos";
import { SALES_TYPES } from "@/config/sales";
import { listOrganizationRoles } from "@/lib/organization";
import { normalizeSearch } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  optionSearchSchema,
  roleOptionSearchSchema,
  stageOptionSearchSchema,
} from "@/lib/validations/options";

// Searchable selects read their options here, one page at a time, so no list
// is cut at a fixed size in the browser. Each source checks the same
// permission as the list it comes from.

export interface OptionItem {
  value: string;
  label: string;
  description?: string;
}

export interface OptionPage {
  items: OptionItem[];
  hasMore: boolean;
}

const { pageSize } = OPTION_DEFAULTS;

/** Offset of a page; one extra row tells whether there is a next page. */
const window = (page: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize + 1,
});

/** Search results are cut to one page; resolved `ids` are returned whole. */
const toPage = (items: OptionItem[], ids: string[]): OptionPage =>
  ids.length
    ? { items, hasMore: false }
    : { items: items.slice(0, pageSize), hasMore: items.length > pageSize };

const contains = (q: string) => ({ contains: q, mode: "insensitive" }) as const;

/** Members of the active organization; the value is the user id. */
export async function searchMemberOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await getActorContext();
    const where: Prisma.MemberWhereInput = { organizationId };

    if (ids.length) where.userId = { in: ids };
    else if (q) {
      where.user = { OR: [{ name: contains(q) }, { email: contains(q) }] };
    }

    const members = await prisma.member.findMany({
      where,
      orderBy: [{ user: { name: "asc" } }, { id: "asc" }],
      ...(ids.length ? {} : window(page)),
      select: { userId: true, user: { select: { name: true, email: true } } },
    });

    return toPage(
      members.map((member) => ({
        value: member.userId,
        label: member.user.name,
        description: member.user.email,
      })),
      ids,
    );
  });
}

/** Roles of the active organization; the value is the role name. */
export async function searchRoleOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(
    roleOptionSearchSchema,
    input,
    async ({ q, page, ids, purpose }) => {
      const { organizationId, access } = await getActorContext();
      // At most 50 roles and the owner role is not stored, so filter in memory.
      const roles = await listOrganizationRoles(organizationId, {
        includePermissions: false,
      });
      const canOfferOwner =
        purpose === "filter" || (purpose === "assign" && access.isOwner);
      const term = normalizeSearch(q);
      const matches = roles.filter((role) =>
        ids.length
          ? ids.includes(role.role)
          : (canOfferOwner || !role.isSystem) &&
            normalizeSearch(`${role.label} ${role.description ?? ""}`).includes(
              term,
            ),
      );
      const { skip, take } = window(page);

      return toPage(
        (ids.length ? matches : matches.slice(skip, skip + take)).map(
          (role) => ({
            value: role.role,
            label: role.label,
            description: role.description ?? undefined,
          }),
        ),
        ids,
      );
    },
  );
}

/** Customer statuses in their lifecycle order. Any member can read them. */
export async function searchCustomerStatusOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await getActorContext();
    const statuses = await prisma.customerStatus.findMany({
      where: {
        organizationId,
        ...(ids.length ? { id: { in: ids } } : q ? { label: contains(q) } : {}),
      },
      orderBy: { position: "asc" },
      ...(ids.length ? {} : window(page)),
      select: { id: true, label: true },
    });

    return toPage(
      statuses.map((status) => ({ value: status.id, label: status.label })),
      ids,
    );
  });
}

/** Distinct tags of a table of the organization matching `q`, one page. */
async function findTagPage(
  table: "customer" | "lead" | "product" | "service",
  organizationId: string,
  { q, page, ids }: { q: string; page: number; ids: string[] },
) {
  // Tags are their own value, so resolving them needs no query.
  if (ids.length) {
    return toPage(
      ids.map((tag) => ({ value: tag, label: tag })),
      ids,
    );
  }

  const { skip, take } = window(page);
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT tag
    FROM ${Prisma.raw(`"${table}"`)}, unnest("tags") AS tag
    WHERE "organizationId" = ${organizationId}
      AND tag ILIKE ${`%${q.replace(/[\\%_]/g, "\\$&")}%`}
    ORDER BY tag
    OFFSET ${skip}
    LIMIT ${take}
  `;

  return toPage(
    rows.map(({ tag }) => ({ value: tag, label: tag })),
    ids,
  );
}

/** Tags used by the organization's customers. */
export async function searchCustomerTagOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ customer: ["read"] });

    return findTagPage("customer", organizationId, params);
  });
}

/** Tags used by the organization's leads. */
export async function searchLeadTagOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ lead: ["read"] });

    return findTagPage("lead", organizationId, params);
  });
}

/** Pipelines in their board order. */
export async function searchPipelineOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await requirePermission({ lead: ["read"] });
    const pipelines = await prisma.pipeline.findMany({
      where: {
        organizationId,
        ...(ids.length ? { id: { in: ids } } : q ? { name: contains(q) } : {}),
      },
      orderBy: { position: "asc" },
      ...(ids.length ? {} : window(page)),
      select: { id: true, name: true },
    });

    return toPage(
      pipelines.map((pipeline) => ({
        value: pipeline.id,
        label: pipeline.name,
      })),
      ids,
    );
  });
}

/** Stages of one pipeline of the active organization, in order. */
export async function searchStageOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(
    stageOptionSearchSchema,
    input,
    async ({ q, page, ids, pipelineId }) => {
      const { organizationId } = await requirePermission({ lead: ["read"] });
      const stages = await prisma.pipelineStage.findMany({
        where: {
          pipelineId,
          organizationId,
          ...(ids.length
            ? { id: { in: ids } }
            : q
              ? { name: contains(q) }
              : {}),
        },
        orderBy: { position: "asc" },
        ...(ids.length ? {} : window(page)),
        select: { id: true, name: true },
      });

      return toPage(
        stages.map((stage) => ({ value: stage.id, label: stage.name })),
        ids,
      );
    },
  );
}

/** Product categories in their configured order. Any member can read them. */
export async function searchProductCategoryOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await getActorContext();
    const categories = await prisma.productCategory.findMany({
      where: {
        organizationId,
        ...(ids.length ? { id: { in: ids } } : q ? { name: contains(q) } : {}),
      },
      orderBy: { position: "asc" },
      ...(ids.length ? {} : window(page)),
      select: { id: true, name: true },
    });

    return toPage(
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
      ids,
    );
  });
}

/** Tags used by the organization's products. */
export async function searchProductTagOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ product: ["read"] });

    return findTagPage("product", organizationId, params);
  });
}

/** Service categories in their configured order. Any member can read them. */
export async function searchServiceCategoryOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await getActorContext();
    const categories = await prisma.serviceCategory.findMany({
      where: {
        organizationId,
        ...(ids.length ? { id: { in: ids } } : q ? { name: contains(q) } : {}),
      },
      orderBy: { position: "asc" },
      ...(ids.length ? {} : window(page)),
      select: { id: true, name: true },
    });

    return toPage(
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
      ids,
    );
  });
}

/** Tags used by the organization's services. */
export async function searchServiceTagOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ service: ["read"] });

    return findTagPage("service", organizationId, params);
  });
}

/** Customers by name; the description helps tell namesakes apart. */
export async function searchCustomerOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await requirePermission({ customer: ["read"] });
    const customers = await prisma.customer.findMany({
      where: {
        organizationId,
        ...(ids.length
          ? { id: { in: ids } }
          : q
            ? {
                OR: [
                  { name: contains(q) },
                  { companyName: contains(q) },
                  { email: contains(q) },
                  { taxId: contains(q) },
                ],
              }
            : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...(ids.length ? {} : window(page)),
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        taxId: true,
      },
    });

    return toPage(
      customers.map((customer) => ({
        value: customer.id,
        label: customer.name,
        description:
          [customer.companyName, customer.taxId ?? customer.email]
            .filter(Boolean)
            .join(" · ") || undefined,
      })),
      ids,
    );
  });
}

/**
 * Active products and services to sell in a document line. The value is
 * "product:<id>" or "service:<id>".
 */
export async function searchSalesItemOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await requirePermission({ sale: ["read"] });
    const refs = ids.map((id) => id.split(":"));
    const productIds = refs.flatMap(([kind, id]) =>
      kind === "product" && id ? [id] : [],
    );
    const serviceIds = refs.flatMap(([kind, id]) =>
      kind === "service" && id ? [id] : [],
    );
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const { skip, take } = window(page);
    // Selected items are resolved even when inactive; searches only list
    // active ones.
    const rows = await prisma.$queryRaw<
      {
        value: string;
        label: string;
        code: string | null;
        kind: string;
        presentations: number;
      }[]
    >`
      SELECT * FROM (
        SELECT 'product:' || p.id AS value, p.name AS label, p.sku AS code,
          'product' AS kind,
          (SELECT COUNT(*)::int FROM "product_presentation" pp
            WHERE pp."productId" = p.id) AS presentations
        FROM "product" p
        WHERE p."organizationId" = ${organizationId}
          AND ${
            ids.length
              ? Prisma.sql`p.id = ANY(${productIds}::text[])`
              : Prisma.sql`p."isActive" AND (p.name ILIKE ${pattern}
                  OR p.sku ILIKE ${pattern} OR p.barcode = ${q}
                  OR EXISTS (SELECT 1 FROM "product_presentation" pp
                    WHERE pp."productId" = p.id AND pp.barcode = ${q}))`
          }
        UNION ALL
        SELECT 'service:' || id, name, code, 'service', 0
        FROM "service"
        WHERE "organizationId" = ${organizationId}
          AND ${
            ids.length
              ? Prisma.sql`id = ANY(${serviceIds}::text[])`
              : Prisma.sql`"isActive" AND (name ILIKE ${pattern} OR code ILIKE ${pattern})`
          }
      ) items
      ORDER BY label, value
      ${ids.length ? Prisma.empty : Prisma.sql`OFFSET ${skip} LIMIT ${take}`}
    `;

    return toPage(
      rows.map((row) => ({
        value: row.value,
        label: row.label,
        description: [
          row.kind === "product" ? "Producto" : "Servicio",
          row.code,
          row.presentations === 1
            ? "1 presentación"
            : row.presentations > 1
              ? `${row.presentations} presentaciones`
              : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      ids,
    );
  });
}

/** Active payment methods (every one when resolving ids), in their order. */
export async function searchPaymentMethodOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await getActorContext();
    const methods = await prisma.paymentMethod.findMany({
      where: {
        organizationId,
        ...(ids.length
          ? { id: { in: ids } }
          : { isActive: true, ...(q ? { name: contains(q) } : {}) }),
      },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      ...(ids.length ? {} : window(page)),
      select: { id: true, name: true, kind: true },
    });

    return toPage(
      methods.map((method) => ({
        value: method.id,
        label: method.name,
        description: paymentMethodKindLabel(method.kind),
      })),
      ids,
    );
  });
}

/** Active registers, saying whether someone has them open. */
export async function searchCashRegisterOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await requirePermission({ pos: ["read"] });
    const registers = await prisma.cashRegister.findMany({
      where: {
        organizationId,
        ...(ids.length
          ? { id: { in: ids } }
          : { isActive: true, ...(q ? { name: contains(q) } : {}) }),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...(ids.length ? {} : window(page)),
      select: {
        id: true,
        name: true,
        sessions: {
          where: { status: "OPEN" },
          select: { openedBy: { select: { name: true } } },
        },
      },
    });

    return toPage(
      registers.map((register) => {
        const open = register.sessions[0];

        return {
          value: register.id,
          label: register.name,
          description: open
            ? `Abierta por ${open.openedBy?.name ?? "otra persona"}`
            : "Libre",
        };
      }),
      ids,
    );
  });
}

const posMoney = async (organizationId: string) => {
  const { currency } = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { currency: true },
  });

  return new Intl.NumberFormat(APP_LOCALE, { style: "currency", currency });
};

/**
 * Quotes and orders that can be charged at the till: still open and without
 * documents created from them (those continue in the sales flow).
 */
export async function searchPosSourceOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await requirePermission({ pos: ["sell"] });
    const documents = await prisma.salesDocument.findMany({
      where: {
        organizationId,
        ...(ids.length
          ? { id: { in: ids } }
          : {
              OR: [
                {
                  type: "QUOTE",
                  status: { in: [...POS_LOADABLE_STATUSES.QUOTE] },
                },
                {
                  type: "ORDER",
                  status: { in: [...POS_LOADABLE_STATUSES.ORDER] },
                },
              ],
              derived: { none: { status: { not: "CANCELLED" } } },
              ...(q
                ? {
                    AND: [
                      {
                        OR: [
                          { number: contains(q) },
                          { customerName: contains(q) },
                          { reference: contains(q) },
                        ],
                      },
                    ],
                  }
                : {}),
            }),
      },
      orderBy: [{ issueDate: "desc" }, { id: "asc" }],
      ...(ids.length ? {} : window(page)),
      select: {
        id: true,
        type: true,
        number: true,
        customerName: true,
        total: true,
      },
    });
    const money = await posMoney(organizationId);

    return toPage(
      documents.map((document) => ({
        value: document.id,
        label:
          `${SALES_TYPES[document.type].label} ${document.number ?? ""}`.trim(),
        description: `${document.customerName} · ${money.format(document.total.toNumber())}`,
      })),
      ids,
    );
  });
}

/** Issued invoices with an amount still to collect. */
export async function searchPendingInvoiceOptions(
  input: unknown,
): Promise<ActionResult<OptionPage>> {
  return runAction(optionSearchSchema, input, async ({ q, page, ids }) => {
    const { organizationId } = await requirePermission({ pos: ["sell"] });
    const documents = await prisma.salesDocument.findMany({
      where: {
        organizationId,
        type: "INVOICE",
        ...(ids.length
          ? { id: { in: ids } }
          : {
              status: "ISSUED",
              ...(q
                ? {
                    OR: [
                      { number: contains(q) },
                      { customerName: contains(q) },
                      { customerTaxId: contains(q) },
                    ],
                  }
                : {}),
            }),
      },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
      ...(ids.length ? {} : window(page)),
      select: {
        id: true,
        number: true,
        customerName: true,
        total: true,
        paidTotal: true,
      },
    });
    const money = await posMoney(organizationId);

    return toPage(
      documents.map((document) => ({
        value: document.id,
        label: `${document.number ?? "Borrador"} · ${document.customerName}`,
        description: `Pendiente ${money.format(
          document.total.toNumber() - document.paidTotal.toNumber(),
        )}`,
      })),
      ids,
    );
  });
}
