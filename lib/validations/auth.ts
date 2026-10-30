import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .string()
  .trim()
  .min(1, "Introduce tu correo")
  .pipe(z.email("Introduce un correo válido"));

export const personNameSchema = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(100, "Máximo 100 caracteres");

export const emailSchema = email;

export const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `Máximo ${PASSWORD_MAX_LENGTH} caracteres`);

export const confirmPassword = z.string().min(1, "Confirma tu contraseña");

export const passwordsMatch = (data: {
  password: string;
  confirmPassword: string;
}) => data.password === data.confirmPassword;

export const passwordsMatchError = {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
};

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Introduce tu contraseña"),
});

export const signUpSchema = z
  .object({
    name: personNameSchema,
    email,
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch, passwordsMatchError);

export const forgotPasswordSchema = z.object({ email });

export const resendVerificationSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch, passwordsMatchError);

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResendVerificationValues = z.infer<typeof resendVerificationSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
