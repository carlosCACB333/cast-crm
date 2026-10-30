import "server-only";

import { z } from "zod";

/**
 * Settings that change per deployment (not per organization), read from the
 * environment once at startup.
 *
 * `DEPLOYMENT_MODE`:
 * - `multi` (default): SaaS. Anyone with an account can create organizations.
 * - `single`: one company. Only the first user (while no organization exists
 *   yet) and owners of an existing organization can create more, as branches;
 *   everyone else joins by invitation.
 */
const deploymentSchema = z.object({
  DEPLOYMENT_MODE: z.enum(["multi", "single"]).default("multi"),
});

const env = deploymentSchema.parse({
  DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE || undefined,
});

export const deploymentConfig = {
  mode: env.DEPLOYMENT_MODE,
  isSingleCompany: env.DEPLOYMENT_MODE === "single",
} as const;
