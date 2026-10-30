import type { Metadata } from "next";

import { Suspense } from "react";

import { LeadsBoardView } from "@/components/leads/leads-board-view";
import { ListSkeleton } from "@/components/organization/query-state";

export const metadata: Metadata = { title: "Kanban" };

export default async function PipelineKanbanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    // The board reads its search and owner filters from the URL.
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <LeadsBoardView pipelineId={id} />
    </Suspense>
  );
}
