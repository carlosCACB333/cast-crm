"use server";

import { APIError } from "better-auth/api";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { LEAD_LIMITS } from "@/config/leads";
import { TABLE_DEFAULTS } from "@/config/tables";
import { Prisma } from "@/lib/generated/prisma/client";
import { pageWindow } from "@/lib/pagination";
import {
  buildLeadWhere,
  findLeadOrThrow,
  findStage,
  leadCardSelect,
  leadDetailSelect,
  resolveClosedAt,
  serializeLead,
  toLeadData,
  topPosition,
} from "@/lib/leads";
import { includesPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  type CustomerLeadListParams,
  type LeadBoardFilters,
  customerLeadListSchema,
  leadBoardSchema,
  leadFormSchema,
  leadIdSchema,
  leadNoteSchema,
  moveLeadSchema,
  updateLeadSchema,
} from "@/lib/validations/leads";

// Every action derives the organization from the session and checks the
// `lead:*` permission of the caller's role before touching data.

async function findBoard(
  organizationId: string,
  userId: string,
  filters: LeadBoardFilters,
) {
  // An explicit id (from the URL) must exist; "" falls back to the first one.
  const [pipeline, pipelineCount] = await Promise.all([
    prisma.pipeline.findFirst({
      where: {
        organizationId,
        ...(filters.pipelineId ? { id: filters.pipelineId } : {}),
      },
      orderBy: { position: "asc" },
      select: { id: true, name: true, description: true },
    }),
    prisma.pipeline.count({ where: { organizationId } }),
  ]);

  if (filters.pipelineId && !pipeline) {
    throw new APIError("NOT_FOUND", { code: "PIPELINE_NOT_FOUND" });
  }

  if (!pipeline) return { pipelineCount, pipeline: null, stages: [] };

  const where = buildLeadWhere(organizationId, userId, pipeline.id, filters);
  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      kind: true,
      probability: true,
    },
  });

  const [leads, totals] = await Promise.all([
    Promise.all(
      stages.map((stage) =>
        prisma.lead.findMany({
          where: { ...where, stageId: stage.id },
          orderBy: [{ position: "asc" }, { id: "asc" }],
          take: LEAD_LIMITS.cardsPerStage,
          select: leadCardSelect,
        }),
      ),
    ),
    prisma.lead.groupBy({
      by: ["stageId"],
      where,
      orderBy: { stageId: "asc" },
      _count: { _all: true },
      _sum: { value: true },
    }),
  ]);

  return {
    /** Pipelines of the organization, to show the pipeline picker. */
    pipelineCount,
    pipeline,
    stages: stages.map((stage, index) => {
      const total = totals.find((row) => row.stageId === stage.id);
      const count =
        total && typeof total._count === "object"
          ? (total._count._all ?? 0)
          : 0;

      return {
        ...stage,
        count,
        totalValue: total?._sum?.value?.toNumber() ?? 0,
        leads: leads[index].map(serializeLead),
      };
    }),
  };
}

export type LeadBoard = Awaited<ReturnType<typeof findBoard>>;
export type LeadBoardStage = LeadBoard["stages"][number];
export type LeadCard = LeadBoardStage["leads"][number];

export async function getLeadBoard(
  input: unknown,
): Promise<ActionResult<LeadBoard>> {
  return runAction(leadBoardSchema, input, async (filters) => {
    const { organizationId, session } = await requirePermission({
      lead: ["read"],
    });

    return findBoard(organizationId, session.user.id, filters);
  });
}

async function findLead(organizationId: string, id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
    select: leadDetailSelect,
  });

  if (!lead) throw new APIError("NOT_FOUND", { code: "LEAD_NOT_FOUND" });

  return serializeLead(lead);
}

export type LeadDetail = Awaited<ReturnType<typeof findLead>>;

export async function getLead(id: unknown): Promise<ActionResult<LeadDetail>> {
  return runAction(leadIdSchema, id, async (leadId) => {
    const { organizationId } = await requirePermission({ lead: ["read"] });

    return findLead(organizationId, leadId);
  });
}

async function findCustomerLeads(
  organizationId: string,
  {
    customerId,
    q,
    kinds,
    pipelineIds,
    sort,
    direction,
    page,
  }: CustomerLeadListParams,
) {
  const base = { organizationId, customerId };
  const where: Prisma.LeadWhereInput = { ...base };

  if (q) where.title = { contains: q, mode: "insensitive" };
  if (kinds.length) where.stage = { kind: { in: kinds } };
  if (pipelineIds.length) where.pipelineId = { in: pipelineIds };

  const orderBy: Record<typeof sort, Prisma.LeadOrderByWithRelationInput> = {
    title: { title: direction },
    pipeline: { pipeline: { name: direction } },
    stage: { stage: { name: direction } },
    value: { value: { sort: direction, nulls: "last" } },
    updatedAt: { updatedAt: direction },
  };

  const [total, open, pipelineCount] = await prisma.$transaction([
    prisma.lead.count({ where }),
    // Totals of the customer, regardless of the table filters.
    prisma.lead.aggregate({
      where: { ...base, stage: { kind: "OPEN" } },
      _sum: { value: true },
    }),
    prisma.pipeline.count({
      where: { organizationId, leads: { some: { customerId } } },
    }),
  ]);
  const window = pageWindow(page, TABLE_DEFAULTS.pageSize, total);
  const leads = await prisma.lead.findMany({
    where,
    orderBy: [orderBy[sort], { id: "asc" }],
    skip: window.skip,
    take: window.take,
    select: {
      ...leadCardSelect,
      stage: { select: { id: true, name: true, color: true, kind: true } },
      pipeline: { select: { id: true, name: true } },
    },
  });

  return {
    ...window,
    total,
    items: leads.map(serializeLead),
    openValue: open._sum.value?.toNumber() ?? 0,
    /** Pipelines the customer has leads in (the filter needs several). */
    pipelineCount,
  };
}

export type CustomerLeadPage = Awaited<ReturnType<typeof findCustomerLeads>>;
export type CustomerLead = CustomerLeadPage["items"][number];

/** Leads linked to a customer, shown on the customer page. */
export async function listCustomerLeads(
  input: unknown,
): Promise<ActionResult<CustomerLeadPage>> {
  return runAction(customerLeadListSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ lead: ["read"] });

    return findCustomerLeads(organizationId, params);
  });
}

export async function createLead(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(leadFormSchema, input, async (values) => {
    const { organizationId, session } = await requirePermission({
      lead: ["create"],
    });
    const { stage, data } = await toLeadData(organizationId, values);

    return prisma.lead.create({
      data: {
        ...data,
        organizationId,
        createdById: session.user.id,
        position: await topPosition(stage.id),
        closedAt: resolveClosedAt(stage.kind, null),
      },
      select: { id: true },
    });
  });
}

export async function updateLead(input: unknown): Promise<ActionResult> {
  return runAction(updateLeadSchema, input, async ({ id, values }) => {
    const { organizationId } = await requirePermission({ lead: ["update"] });
    const current = await findLeadOrThrow(organizationId, id);
    const { stage, data } = await toLeadData(organizationId, values);
    const hasMoved = stage.id !== current.stageId;

    await prisma.lead.update({
      where: { id },
      data: {
        ...data,
        closedAt: resolveClosedAt(stage.kind, current.closedAt),
        ...(hasMoved ? { position: await topPosition(stage.id) } : {}),
      },
    });

    return undefined;
  });
}

/** Drag and drop: moves a lead to a stage of its pipeline at a given index. */
export async function moveLead(input: unknown): Promise<ActionResult> {
  return runAction(moveLeadSchema, input, async ({ id, stageId, index }) => {
    const { organizationId } = await requirePermission({ lead: ["update"] });
    const lead = await findLeadOrThrow(organizationId, id);
    const stage = await findStage(organizationId, stageId, lead.pipelineId);
    const siblings = await prisma.lead.findMany({
      where: { stageId: stage.id, NOT: { id } },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const ordered = siblings.map((item) => item.id);

    ordered.splice(Math.min(index, ordered.length), 0, id);

    // Rewrites the column so positions stay compact and unique.
    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          stageId: stage.id,
          closedAt: resolveClosedAt(stage.kind, lead.closedAt),
        },
      }),
      ...ordered.map((leadId, position) =>
        prisma.lead.update({ where: { id: leadId }, data: { position } }),
      ),
    ]);

    return undefined;
  });
}

export async function deleteLead(id: unknown): Promise<ActionResult> {
  return runAction(leadIdSchema, id, async (leadId) => {
    const { organizationId } = await requirePermission({ lead: ["delete"] });
    const { count } = await prisma.lead.deleteMany({
      where: { id: leadId, organizationId },
    });

    if (count === 0)
      throw new APIError("NOT_FOUND", { code: "LEAD_NOT_FOUND" });

    return undefined;
  });
}

/**
 * Links the lead to a customer: reuses a customer with the same email or
 * creates a new one from the lead's contact details.
 */
export async function convertLeadToCustomer(
  id: unknown,
): Promise<ActionResult<{ customerId: string; isNew: boolean }>> {
  return runAction(leadIdSchema, id, async (leadId) => {
    const { organizationId, session } = await requirePermission({
      lead: ["update"],
      customer: ["create"],
    });
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      select: {
        title: true,
        contactName: true,
        companyName: true,
        email: true,
        phone: true,
        tags: true,
        ownerId: true,
        customerId: true,
      },
    });

    if (!lead) throw new APIError("NOT_FOUND", { code: "LEAD_NOT_FOUND" });
    if (lead.customerId) return { customerId: lead.customerId, isNew: false };

    const existing = lead.email
      ? await prisma.customer.findFirst({
          where: { organizationId, email: lead.email },
          select: { id: true },
        })
      : null;

    if (existing) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { customerId: existing.id },
      });

      return { customerId: existing.id, isNew: false };
    }

    const isPerson = Boolean(lead.contactName);
    const firstStatus = await prisma.customerStatus.findFirst({
      where: { organizationId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          organizationId,
          type: isPerson ? "PERSON" : "COMPANY",
          name: lead.contactName ?? lead.companyName ?? lead.title,
          companyName: isPerson ? lead.companyName : null,
          email: lead.email,
          phone: lead.phone,
          tags: lead.tags,
          ownerId: lead.ownerId,
          statusId: firstStatus?.id ?? null,
          createdById: session.user.id,
        },
        select: { id: true },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { customerId: created.id },
      });

      return created;
    });

    return { customerId: customer.id, isNew: true };
  });
}

async function findNotes(
  organizationId: string,
  leadId: string,
  userId: string,
  canDeleteAny: boolean,
) {
  const notes = await prisma.leadNote.findMany({
    where: { leadId, organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return notes.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
    canDelete: canDeleteAny || note.author?.id === userId,
  }));
}

export async function listLeadNotes(
  leadId: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof findNotes>>>> {
  return runAction(leadIdSchema, leadId, async (id) => {
    const { organizationId, session, access } = await requirePermission({
      lead: ["read"],
    });

    await findLeadOrThrow(organizationId, id);

    return findNotes(
      organizationId,
      id,
      session.user.id,
      includesPermissions(access.permissions, { lead: ["delete"] }),
    );
  });
}

export async function addLeadNote(input: unknown): Promise<ActionResult> {
  return runAction(leadNoteSchema, input, async ({ leadId, body }) => {
    const { organizationId, session } = await requirePermission({
      lead: ["update"],
    });

    await findLeadOrThrow(organizationId, leadId);
    await prisma.$transaction([
      prisma.leadNote.create({
        data: { organizationId, leadId, body, authorId: session.user.id },
      }),
      prisma.lead.update({
        where: { id: leadId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return undefined;
  });
}

/** Authors can delete their own notes; `lead:delete` can delete any note. */
export async function deleteLeadNote(id: unknown): Promise<ActionResult> {
  return runAction(leadIdSchema, id, async (noteId) => {
    const { organizationId, session, access } = await requirePermission({
      lead: ["read"],
    });
    const canDeleteAny = includesPermissions(access.permissions, {
      lead: ["delete"],
    });
    const { count } = await prisma.leadNote.deleteMany({
      where: {
        id: noteId,
        organizationId,
        ...(canDeleteAny ? {} : { authorId: session.user.id }),
      },
    });

    if (count === 0)
      throw new APIError("NOT_FOUND", { code: "NOTE_NOT_FOUND" });

    return undefined;
  });
}
