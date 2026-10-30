import { z } from "zod";

import {
  confirmPassword,
  emailSchema,
  newPassword,
  passwordsMatch,
  passwordsMatchError,
  personNameSchema,
} from "@/lib/validations/auth";

export const updateProfileSchema = z.object({ name: personNameSchema });

export const changeEmailSchema = z.object({ email: emailSchema });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Introduce tu contraseña actual"),
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch, passwordsMatchError);

/** For accounts created with a social provider, which have no password yet. */
export const setPasswordSchema = z
  .object({ password: newPassword, confirmPassword })
  .refine(passwordsMatch, passwordsMatchError);

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type SetPasswordValues = z.infer<typeof setPasswordSchema>;
