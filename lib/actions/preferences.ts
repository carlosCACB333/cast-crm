"use server";

import { z } from "zod";

import { getActorContext, requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import { type CurrencyCode, DEFAULT_CURRENCY } from "@/config/organization";
import { prisma } from "@/lib/prisma";
import { decimalToText } from "@/lib/pricing";
import { toDecimal } from "@/lib/validations/fields";
import {
  type OrganizationTaxesValues,
  organizationPreferencesSchema,
  organizationTaxesSchema,
} from "@/lib/validations/organization";

export interface OrganizationPreferences {
  currency: CurrencyCode;
}

/** Business preferences of the active organization, readable by any member. */
export async function getOrganizationPreferences(): Promise<
  ActionResult<OrganizationPreferences>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await getActorContext();
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    });
    const parsed = organizationPreferencesSchema.safeParse(organization);

    return parsed.success ? parsed.data : { currency: DEFAULT_CURRENCY };
  });
}

export async function updateOrganizationPreferences(
  input: unknown,
): Promise<ActionResult> {
  return runAction(organizationPreferencesSchema, input, async (data) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });

    await prisma.organization.update({ where: { id: organizationId }, data });

    return undefined;
  });
}

/** Default tax rate and tax on the total, readable by any member. */
export async function getOrganizationTaxes(): Promise<
  ActionResult<OrganizationTaxesValues>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await getActorContext();
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        defaultTaxRate: true,
        totalTaxEnabled: true,
        totalTaxName: true,
        totalTaxRate: true,
      },
    });

    return {
      defaultTaxRate: decimalToText(
        organization.defaultTaxRate?.toNumber() ?? null,
      ),
      totalTaxEnabled: organization.totalTaxEnabled,
      totalTaxName: organization.totalTaxName,
      totalTaxRate: decimalToText(
        organization.totalTaxRate?.toNumber() ?? null,
      ),
    };
  });
}

export async function updateOrganizationTaxes(
  input: unknown,
): Promise<ActionResult> {
  return runAction(organizationTaxesSchema, input, async (values) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        defaultTaxRate: toDecimal(values.defaultTaxRate),
        totalTaxEnabled: values.totalTaxEnabled,
        // The name is kept while disabled so it is there when re-enabled.
        ...(values.totalTaxName ? { totalTaxName: values.totalTaxName } : {}),
        totalTaxRate: toDecimal(values.totalTaxRate),
      },
    });

    return undefined;
  });
}
