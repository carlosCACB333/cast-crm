"use server";

import { APIError } from "better-auth/api";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { LEAD_LIMITS, NEW_PIPELINE_STAGES } from "@/config/leads";
import { TABLE_DEFAULTS } from "@/config/tables";
import { type Page, paginateInMemory } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { emptyToNull } from "@/lib/validations/fields";
import {
  type StageFormValues,
  createStageSchema,
  deleteStageSchema,
  leadIdSchema,
  moveItemSchema,
  pipelineFormSchema,
  pipelineIdSchema,
  pipelineListSchema,
  updatePipelineSchema,
  updateStageSchema,
} from "@/lib/validations/leads";

// Reading pipelines requires `lead:read`; changing them, `pipeline:manage`.

/** Pipelines with their stages and totals; `id` narrows it to one pipeline. */
async function findPipelines(organizationId: string, id?: string) {
  const [pipelines, totals] = await Promise.all([
    prisma.pipeline.findMany({
      where: { organizationId, ...(id ? { id } : {}) },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { leads: true } },
        stages: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            color: true,
            kind: true,
            probability: true,
            _count: { select: { leads: true } },
          },
        },
      },
    }),
    prisma.lead.groupBy({
      by: ["stageId"],
      where: { organizationId, ...(id ? { pipelineId: id } : {}) },
      orderBy: { stageId: "asc" },
      _sum: { value: true },
    }),
  ]);
  const stageValue = (stageId: string) =>
    totals.find((row) => row.stageId === stageId)?._sum?.value?.toNumber() ?? 0;

  return pipelines.map(({ _count, stages, ...pipeline }) => {
    const items = stages.map(({ _count: stageCount, ...stage }) => ({
      ...stage,
      leadCount: stageCount.leads,
      totalValue: stageValue(stage.id),
    }));
    const open = items.filter((stage) => stage.kind === "OPEN");

    return {
      ...pipeline,
      leadCount: _count.leads,
      openCount: open.reduce((sum, stage) => sum + stage.leadCount, 0),
      openValue: open.reduce((sum, stage) => sum + stage.totalValue, 0),
      /** Open value weighted by each stage's probability. */
      forecast: open.reduce(
        (sum, stage) =>
          sum + (stage.totalValue * (stage.probability ?? 0)) / 100,
        0,
      ),
      stages: items,
    };
  });
}

export type PipelineItem = Awaited<ReturnType<typeof findPipelines>>[number];
export type PipelineStageItem = PipelineItem["stages"][number];

/**
 * One pipeline with its stages, or the first one of the organization when
 * `id` is "". Returns null when the organization has no pipelines.
 */
export async function getPipeline(
  id: unknown,
): Promise<ActionResult<PipelineItem | null>> {
  return runAction(pipelineIdSchema, id, async (pipelineId) => {
    const { organizationId } = await requirePermission({ lead: ["read"] });
    const target =
      pipelineId ||
      (
        await prisma.pipeline.findFirst({
          where: { organizationId },
          orderBy: { position: "asc" },
          select: { id: true },
        })
      )?.id;

    if (!target) return null;

    const [pipeline] = await findPipelines(organizationId, target);

    if (!pipeline) {
      throw new APIError("NOT_FOUND", { code: "PIPELINE_NOT_FOUND" });
    }

    return pipeline;
  });
}

/**
 * Pipelines table. Its totals are computed per stage, so the page is built in
 * memory on the server; the browser only receives one page.
 */
export async function listPipelinePage(
  input: unknown,
): Promise<ActionResult<Page<PipelineItem>>> {
  return runAction(pipelineListSchema, input, async (params) => {
    const { organizationId } = await requirePermission({ lead: ["read"] });
    const pipelines = await findPipelines(organizationId);
    const { sort } = params;

    return paginateInMemory(pipelines, {
      ...params,
      pageSize: TABLE_DEFAULTS.pageSize,
      searchText: (pipeline) => [pipeline.name, pipeline.description],
      sortValue: (pipeline) =>
        sort === "position"
          ? pipelines.indexOf(pipeline)
          : sort === "name"
            ? pipeline.name
            : pipeline[sort],
    });
  });
}

function stageData(values: StageFormValues) {
  return {
    name: values.name,
    color: values.color,
    kind: values.kind,
    probability: values.probability === "" ? null : Number(values.probability),
  };
}

async function requireManage() {
  return requirePermission({ pipeline: ["manage"] });
}

async function findPipelineOrThrow(organizationId: string, id: string) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });

  if (!pipeline)
    throw new APIError("NOT_FOUND", { code: "PIPELINE_NOT_FOUND" });

  return pipeline;
}

async function findStageOrThrow(organizationId: string, id: string) {
  const stage = await prisma.pipelineStage.findFirst({
    where: { id, organizationId },
    select: { id: true, pipelineId: true, _count: { select: { leads: true } } },
  });

  if (!stage) throw new APIError("NOT_FOUND", { code: "INVALID_STAGE" });

  return stage;
}

/** Swaps an item with its neighbour and rewrites every position. */
function reorder<T extends { id: string }>(
  items: T[],
  id: string,
  direction: "up" | "down",
) {
  const index = items.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || target < 0 || target >= items.length) return null;

  const next = [...items];

  [next[index], next[target]] = [next[target], next[index]];

  return next;
}

export async function createPipeline(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(pipelineFormSchema, input, async ({ name, description }) => {
    const { organizationId } = await requireManage();
    const last = await prisma.pipeline.findFirst({
      where: { organizationId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return prisma.pipeline.create({
      data: {
        organizationId,
        name,
        description: emptyToNull(description),
        position: (last?.position ?? -1) + 1,
        stages: {
          create: NEW_PIPELINE_STAGES.map((stage, position) => ({
            ...stage,
            organizationId,
            position,
          })),
        },
      },
      select: { id: true },
    });
  });
}

export async function updatePipeline(input: unknown): Promise<ActionResult> {
  return runAction(updatePipelineSchema, input, async ({ id, values }) => {
    const { organizationId } = await requireManage();

    await findPipelineOrThrow(organizationId, id);
    await prisma.pipeline.update({
      where: { id },
      data: { name: values.name, description: emptyToNull(values.description) },
    });

    return undefined;
  });
}

/** Deletes a pipeline with all its leads. The last pipeline cannot be deleted. */
export async function deletePipeline(id: unknown): Promise<ActionResult> {
  return runAction(leadIdSchema, id, async (pipelineId) => {
    const { organizationId } = await requireManage();

    await findPipelineOrThrow(organizationId, pipelineId);
    if ((await prisma.pipeline.count({ where: { organizationId } })) <= 1) {
      throw new APIError("BAD_REQUEST", { code: "LAST_PIPELINE" });
    }

    await prisma.$transaction([
      // Stages restrict deleting leads' stage, so remove leads first.
      prisma.lead.deleteMany({ where: { pipelineId, organizationId } }),
      prisma.pipeline.delete({ where: { id: pipelineId } }),
    ]);

    return undefined;
  });
}

/** Adds a stage; open stages go before the first won/lost stage. */
export async function createStage(input: unknown): Promise<ActionResult> {
  return runAction(createStageSchema, input, async ({ pipelineId, values }) => {
    const { organizationId } = await requireManage();

    await findPipelineOrThrow(organizationId, pipelineId);
    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { position: "asc" },
      select: { id: true, kind: true },
    });

    if (stages.length >= LEAD_LIMITS.maxStagesPerPipeline) {
      throw new APIError("BAD_REQUEST", { code: "TOO_MANY_STAGES" });
    }

    const firstClosed = stages.findIndex((stage) => stage.kind !== "OPEN");
    const insertAt =
      values.kind === "OPEN" && firstClosed !== -1
        ? firstClosed
        : stages.length;

    await prisma.$transaction(async (tx) => {
      const created = await tx.pipelineStage.create({
        data: {
          ...stageData(values),
          organizationId,
          pipelineId,
          position: insertAt,
        },
        select: { id: true },
      });
      const ordered = [...stages.map((stage) => stage.id)];

      ordered.splice(insertAt, 0, created.id);
      for (const [position, stageId] of ordered.entries()) {
        await tx.pipelineStage.update({
          where: { id: stageId },
          data: { position },
        });
      }
    });

    return undefined;
  });
}

export async function updateStage(input: unknown): Promise<ActionResult> {
  return runAction(updateStageSchema, input, async ({ id, values }) => {
    const { organizationId } = await requireManage();

    await findStageOrThrow(organizationId, id);
    const data = stageData(values);

    // Changing the kind opens or closes every lead already in the stage.
    await prisma.$transaction([
      prisma.pipelineStage.update({ where: { id }, data }),
      data.kind === "OPEN"
        ? prisma.lead.updateMany({
            where: { stageId: id },
            data: { closedAt: null },
          })
        : prisma.lead.updateMany({
            where: { stageId: id, closedAt: null },
            data: { closedAt: new Date() },
          }),
    ]);

    return undefined;
  });
}

export async function moveStage(input: unknown): Promise<ActionResult> {
  return runAction(moveItemSchema, input, async ({ id, direction }) => {
    const { organizationId } = await requireManage();
    const stage = await findStageOrThrow(organizationId, id);
    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: stage.pipelineId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const next = reorder(stages, id, direction);

    if (next) {
      await prisma.$transaction(
        next.map((item, position) =>
          prisma.pipelineStage.update({
            where: { id: item.id },
            data: { position },
          }),
        ),
      );
    }

    return undefined;
  });
}

/** Deletes a stage, first moving its leads to another stage of the same pipeline. */
export async function deleteStage(input: unknown): Promise<ActionResult> {
  return runAction(deleteStageSchema, input, async ({ id, targetStageId }) => {
    const { organizationId } = await requireManage();
    const stage = await findStageOrThrow(organizationId, id);
    const stageCount = await prisma.pipelineStage.count({
      where: { pipelineId: stage.pipelineId },
    });

    if (stageCount <= 1) {
      throw new APIError("BAD_REQUEST", { code: "LAST_STAGE" });
    }

    if (stage._count.leads > 0) {
      const target = targetStageId
        ? await prisma.pipelineStage.findFirst({
            where: {
              id: targetStageId,
              pipelineId: stage.pipelineId,
              NOT: { id },
            },
            select: { id: true, kind: true },
          })
        : null;

      if (!target) {
        throw new APIError("BAD_REQUEST", { code: "STAGE_TARGET_REQUIRED" });
      }

      const last = await prisma.lead.findFirst({
        where: { stageId: target.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const leads = await prisma.lead.findMany({
        where: { stageId: id },
        orderBy: { position: "asc" },
        select: { id: true, closedAt: true },
      });
      const start = (last?.position ?? -1) + 1;

      await prisma.$transaction([
        ...leads.map((lead, index) =>
          prisma.lead.update({
            where: { id: lead.id },
            data: {
              stageId: target.id,
              position: start + index,
              closedAt:
                target.kind === "OPEN" ? null : (lead.closedAt ?? new Date()),
            },
          }),
        ),
        prisma.pipelineStage.delete({ where: { id } }),
      ]);
    } else {
      await prisma.pipelineStage.delete({ where: { id } });
    }

    return undefined;
  });
}
