import type { Metadata } from "next";

import { Suspense } from "react";

import { PipelinesView } from "@/components/leads/pipelines-view";
import { ListSkeleton } from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Embudos" };

export default function PipelinesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Tableros de leads y los pasos por los que avanzan las oportunidades."
        title="Embudos"
      />
      {/* `?edit=<id>` opens the stage editor of that pipeline. */}
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <PipelinesView />
      </Suspense>
    </div>
  );
}
