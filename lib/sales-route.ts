import { notFound } from "next/navigation";

import { salesTypeBySlug } from "@/config/sales";

/** Document type of a `/sales/[kind]` route; unknown kinds are a 404. */
export async function salesTypeFromParams(params: Promise<{ kind: string }>) {
  const { kind } = await params;
  const definition = salesTypeBySlug(kind);

  if (!definition) notFound();

  return definition;
}
