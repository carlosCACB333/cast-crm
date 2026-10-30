"use server";

import { z } from "zod";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { COLORS } from "@/config/colors";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Aggregates for the dashboard charts. Each module has its own action so it
// only needs that module's read permission, and its mutations (which
// invalidate the module's query keys) refresh it.

/** First day (UTC) of the oldest month in the trend window, and its "YYYY-MM" months. */
function trendWindow() {
  const now = new Date();
  const months = Array.from(
    { length: DASHBOARD_CONFIG.trendMonths },
    (_, i) =>
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - (DASHBOARD_CONFIG.trendMonths - 1 - i),
          1,
        ),
      ),
  );

  return {
    start: months[0],
    months: months.map((month) => month.toISOString().slice(0, 7)),
  };
}

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  value ? Number(value) : 0;

export interface LeadStats {
  openCount: number;
  openValue: number;
  /** Closed in the trend window. */
  wonCount: number;
  wonValue: number;
  lostCount: number;
  /** Won / closed in the trend window; null when nothing was closed. */
  winRate: number | null;
  months: { month: string; created: number; won: number }[];
  /** Stages of the first pipeline with their open and closed leads. */
  pipeline: {
    name: string;
    stages: {
      id: string;
      name: string;
      color: string;
      count: number;
      value: number;
    }[];
  } | null;
}

export async function getLeadStats(): Promise<ActionResult<LeadStats>> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await requirePermission({ lead: ["read"] });
    const { start, months } = trendWindow();
    const closedSince = (kind: "WON" | "LOST") => ({
      organizationId,
      closedAt: { gte: start },
      stage: { kind },
    });

    const [open, won, lostCount, created, wonByMonth, pipeline] =
      await Promise.all([
        prisma.lead.aggregate({
          where: { organizationId, stage: { kind: "OPEN" } },
          _count: { _all: true },
          _sum: { value: true },
        }),
        prisma.lead.aggregate({
          where: closedSince("WON"),
          _count: { _all: true },
          _sum: { value: true },
        }),
        prisma.lead.count({ where: closedSince("LOST") }),
        prisma.$queryRaw<{ month: string; count: number }[]>`
          SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
                 count(*)::int AS count
          FROM "lead"
          WHERE "organizationId" = ${organizationId}
            AND "createdAt" >= ${start}
          GROUP BY 1
        `,
        prisma.$queryRaw<{ month: string; count: number }[]>`
          SELECT to_char(date_trunc('month', l."closedAt"), 'YYYY-MM') AS month,
                 count(*)::int AS count
          FROM "lead" l
          JOIN "pipeline_stage" s ON s."id" = l."stageId"
          WHERE l."organizationId" = ${organizationId}
            AND s."kind" = 'WON'
            AND l."closedAt" >= ${start}
          GROUP BY 1
        `,
        prisma.pipeline.findFirst({
          where: { organizationId },
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            stages: {
              orderBy: { position: "asc" },
              select: { id: true, name: true, color: true },
            },
          },
        }),
      ]);

    const stageTotals = pipeline
      ? await prisma.lead.groupBy({
          by: ["stageId"],
          where: { organizationId, pipelineId: pipeline.id },
          orderBy: { stageId: "asc" },
          _count: { _all: true },
          _sum: { value: true },
        })
      : [];
    const countIn = (rows: { month: string; count: number }[], month: string) =>
      rows.find((row) => row.month === month)?.count ?? 0;
    const closedCount = won._count._all + lostCount;

    return {
      openCount: open._count._all,
      openValue: toNumber(open._sum.value),
      wonCount: won._count._all,
      wonValue: toNumber(won._sum.value),
      lostCount,
      winRate: closedCount ? won._count._all / closedCount : null,
      months: months.map((month) => ({
        month,
        created: countIn(created, month),
        won: countIn(wonByMonth, month),
      })),
      pipeline: pipeline
        ? {
            name: pipeline.name,
            stages: pipeline.stages.map((stage) => {
              const total = stageTotals.find((row) => row.stageId === stage.id);
              const count =
                total && typeof total._count === "object"
                  ? (total._count._all ?? 0)
                  : 0;

              return {
                ...stage,
                count,
                value: toNumber(total?._sum?.value),
              };
            }),
          }
        : null,
    };
  });
}

export interface CustomerStats {
  total: number;
  /** Created in the trend window. */
  newCount: number;
  months: { month: string; created: number }[];
  /** Ordered like the statuses; customers without status come last. */
  statuses: { id: string; label: string; color: string; count: number }[];
}

export async function getCustomerStats(): Promise<ActionResult<CustomerStats>> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await requirePermission({
      customer: ["read"],
    });
    const { start, months } = trendWindow();

    const [total, created, statuses, byStatus] = await Promise.all([
      prisma.customer.count({ where: { organizationId } }),
      prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
               count(*)::int AS count
        FROM "customer"
        WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= ${start}
        GROUP BY 1
      `,
      prisma.customerStatus.findMany({
        where: { organizationId },
        orderBy: { position: "asc" },
        select: { id: true, label: true, color: true },
      }),
      prisma.customer.groupBy({
        by: ["statusId"],
        where: { organizationId },
        orderBy: { statusId: "asc" },
        _count: { _all: true },
      }),
    ]);

    const countOf = (statusId: string | null) => {
      const row = byStatus.find((item) => item.statusId === statusId);

      return row && typeof row._count === "object" ? (row._count._all ?? 0) : 0;
    };
    const withoutStatus = countOf(null);
    const monthly = months.map((month) => ({
      month,
      created: created.find((row) => row.month === month)?.count ?? 0,
    }));

    return {
      total,
      newCount: monthly.reduce((sum, row) => sum + row.created, 0),
      months: monthly,
      statuses: [
        ...statuses.map((status) => ({ ...status, count: countOf(status.id) })),
        ...(withoutStatus
          ? [
              {
                id: "none",
                label: "Sin estado",
                color: COLORS.gray,
                count: withoutStatus,
              },
            ]
          : []),
      ],
    };
  });
}
