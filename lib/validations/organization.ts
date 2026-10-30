import { z } from "zod";

import { CURRENCY_CODES } from "@/config/organization";
import { optionalText, percentField } from "@/lib/validations/fields";
import { filterValues, listQuerySchema } from "@/lib/validations/table";

const name = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(80, "Máximo 80 caracteres");

const slug = z
  .string()
  .trim()
  .min(3, "Mínimo 3 caracteres")
  .max(48, "Máximo 48 caracteres")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Solo minúsculas, números y guiones (sin guiones al inicio o al final)",
  );

const id = z.string().trim().min(1).max(128);

const roleName = z
  .string("Selecciona un rol")
  .trim()
  .min(1, "Selecciona un rol")
  .max(64);

export const createOrganizationSchema = z.object({ name });

export const updateOrganizationSchema = z.object({ name, slug });

/** The user types the organization's name to confirm it is deleted. */
export const deleteOrganizationSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la organización"),
});

/** Same contract, also checking the typed name in the form. */
export const deleteOrganizationFormSchema = (organizationName: string) =>
  deleteOrganizationSchema.refine(
    ({ confirmation }) => confirmation === organizationName.trim(),
    {
      message: "El nombre no coincide con el de la organización",
      path: ["confirmation"],
    },
  );

export const organizationLogoSchema = z.object({
  /** Public id Cloudinary returned for the upload. */
  publicId: z.string().trim().min(1).max(255),
});

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Introduce un correo")
    .pipe(z.email("Introduce un correo válido")),
  role: roleName,
});

export const updateMemberRoleSchema = z.object({
  memberId: id,
  role: roleName,
});

export const organizationPreferencesSchema = z.object({
  currency: z.enum(CURRENCY_CODES, "Selecciona una moneda"),
});

export const organizationTaxesSchema = z
  .object({
    /** Suggested for new products, services and hand-typed lines; "" none. */
    defaultTaxRate: percentField,
    totalTaxEnabled: z.boolean(),
    totalTaxName: optionalText(40),
    totalTaxRate: percentField,
  })
  .refine((values) => !values.totalTaxEnabled || values.totalTaxName, {
    message: "Indica cómo se llama el impuesto",
    path: ["totalTaxName"],
  })
  .refine(
    (values) =>
      !values.totalTaxEnabled ||
      Number(values.totalTaxRate.replace(",", ".")) > 0,
    {
      message: "Indica un porcentaje mayor que 0",
      path: ["totalTaxRate"],
    },
  );

export const idSchema = id;

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationValues = z.infer<typeof updateOrganizationSchema>;
export type DeleteOrganizationValues = z.infer<typeof deleteOrganizationSchema>;
export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
export type OrganizationPreferencesValues = z.infer<
  typeof organizationPreferencesSchema
>;
export type OrganizationTaxesValues = z.infer<typeof organizationTaxesSchema>;
export type UpdateMemberRoleValues = z.infer<typeof updateMemberRoleSchema>;

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const memberListSchema = listQuerySchema(["member", "joined"], {
  sort: "member",
  direction: "asc",
}).extend({ roles: filterValues });

export const invitationListSchema = listQuerySchema(["email", "expires"], {
  sort: "expires",
  direction: "asc",
}).extend({ roles: filterValues });

export type MemberListParams = z.infer<typeof memberListSchema>;
export type InvitationListParams = z.infer<typeof invitationListSchema>;
