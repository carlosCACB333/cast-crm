import type { Metadata } from "next";

import { Suspense } from "react";

import { LeadsBoardView } from "@/components/leads/leads-board-view";
import { ListSkeleton } from "@/components/organization/query-state";

export const metadata: Metadata = { title: "Leads" };

/**
 * "Tablero" in the menu: an empty pipeline id makes the board load the
 * organization's first pipeline, or explain how to create one. It renders in
 * place instead of calling `redirect()` during render, which breaks React's
 * dev performance tracks ("cannot have a negative time stamp").
 */
export default function LeadsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <LeadsBoardView pipelineId="" />
    </Suspense>
  );
}
