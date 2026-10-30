import { z } from "zod";

import { OPTION_DEFAULTS } from "@/config/tables";

export const optionSearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.number().int().min(1).max(1000).default(1),
  /** Resolves the labels of these values instead of searching. */
  ids: z
    .array(z.string().trim().min(1).max(128))
    .max(OPTION_DEFAULTS.maxIds)
    .default([]),
});

export const stageOptionSearchSchema = optionSearchSchema.extend({
  pipelineId: z.string().trim().min(1).max(128),
});

export const roleOptionSearchSchema = optionSearchSchema.extend({
  /**
   * `filter` lists every role; `invite` never offers the owner role and
   * `assign` only offers it to owners (the server enforces both on save).
   */
  purpose: z.enum(["filter", "invite", "assign"]).default("filter"),
});

export type OptionSearchParams = z.input<typeof optionSearchSchema>;
