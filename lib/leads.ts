import "server-only";

import type { StageKind } from "@/config/leads";
import type { LeadBoardFilters, LeadFormValues } from "@/lib/validations/leads";

import { APIError } from "better-auth/api";

import { Prisma } from "@/lib/generated/prisma/client";
import { hasMembership } from "@/lib/organization";
import { prisma } from "@/lib/prisma";
import { emptyToNull, normalizeTags } from "@/lib/validations/fields";

// Every query here is scoped by an organization id that the caller derives
// from the session; none of these functions accept it from the client.

const userSelect = { id: true, name: true, image: true } as const;

export const leadCardSelect = {
  id: true,
  title: true,
  value: true,
  expectedCloseDate: true,
  contactName: true,
  companyName: true,
  tags: true,
  stageId: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: userSelect },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

export const leadDetailSelect = {
  ...leadCardSelect,
  pipelineId: true,
  email: true,
  phone: true,
  source: true,
  lostReason: true,
  stage: {
    select: {
      id: true,
      name: true,
      color: true,
      kind: true,
      probability: true,
    },
  },
  pipeline: { select: { id: true, name: true } },
  createdBy: { select: userSelect },
  _count: { select: { notes: true } },
} satisfies Prisma.LeadSelect;

type DecimalLike = { toNumber(): number } | null;

/** Makes Prisma values serializable for the client (Decimal, Date). */
export function serializeLead<
  T extends {
    value: DecimalLike;
    expectedCloseDate: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  lead: T,
): Omit<
  T,
  "value" | "expectedCloseDate" | "closedAt" | "createdAt" | "updatedAt"
> & {
  value: number | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    ...lead,
    value: lead.value ? lead.value.toNumber() : null,
    expectedCloseDate: lead.expectedCloseDate
      ? lead.expectedCloseDate.toISOString().slice(0, 10)
      : null,
    closedAt: lead.closedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

export function buildLeadWhere(
  organizationId: string,
  userId: string,
  pipelineId: string,
  { q, ownerId }: LeadBoardFilters,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { organizationId, pipelineId };

  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;

    where.OR = [
      { title: contains },
      { contactName: contains },
      { companyName: contains },
      { email: contains },
      { phone: contains },
    ];
  }
  if (ownerId) {
    where.ownerId =
      ownerId === "me" ? userId : ownerId === "none" ? null : ownerId;
  }

  return where;
}

/** Closed stages stamp the closing date once; open stages clear it. */
export function resolveClosedAt(kind: StageKind, previous: Date | null) {
  return kind === "OPEN" ? null : (previous ?? new Date());
}

/** Throws unless the stage belongs to the pipeline and the organization. */
export async function findStage(
  organizationId: string,
  stageId: string,
  pipelineId?: string,
) {
  const stage = await prisma.pipelineStage.findFirst({
    where: {
      id: stageId,
      organizationId,
      ...(pipelineId ? { pipelineId } : {}),
    },
    select: { id: true, pipelineId: true, kind: true },
  });

  if (!stage) throw new APIError("BAD_REQUEST", { code: "INVALID_STAGE" });

  return stage;
}

/** Position that places a lead at the top of a stage column. */
export async function topPosition(stageId: string) {
  const first = await prisma.lead.findFirst({
    where: { stageId },
    orderBy: { position: "asc" },
    select: { position: true },
  });

  return (first?.position ?? 0) - 1;
}

/**
 * Turns validated form values into database data, checking that every
 * referenced record (pipeline, stage, owner, customer) belongs to the organization.
 */
export async function toLeadData(
  organizationId: string,
  values: LeadFormValues,
) {
  const stage = await findStage(
    organizationId,
    values.stageId,
    values.pipelineId,
  );
  const ownerId =
    values.ownerId === "none" ? null : emptyToNull(values.ownerId);
  const customerId = emptyToNull(values.customerId);

  if (ownerId && !(await hasMembership(ownerId, organizationId))) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_LEAD_OWNER" });
  }
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true },
    });

    if (!customer) {
      throw new APIError("NOT_FOUND", { code: "CUSTOMER_NOT_FOUND" });
    }
  }

  return {
    stage,
    data: {
      title: values.title,
      pipelineId: stage.pipelineId,
      stageId: stage.id,
      value: values.value ? values.value.replace(",", ".") : null,
      expectedCloseDate: values.expectedCloseDate
        ? new Date(`${values.expectedCloseDate}T00:00:00Z`)
        : null,
      contactName: emptyToNull(values.contactName),
      companyName: emptyToNull(values.companyName),
      email: emptyToNull(values.email.toLowerCase()),
      phone: emptyToNull(values.phone),
      source: emptyToNull(values.source),
      lostReason: stage.kind === "LOST" ? emptyToNull(values.lostReason) : null,
      tags: normalizeTags(values.tags),
      ownerId,
      customerId,
    },
  };
}

/** Throws NOT_FOUND unless the lead exists in the organization. */
export async function findLeadOrThrow(organizationId: string, id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
    select: { id: true, stageId: true, pipelineId: true, closedAt: true },
  });

  if (!lead) throw new APIError("NOT_FOUND", { code: "LEAD_NOT_FOUND" });

  return lead;
}
