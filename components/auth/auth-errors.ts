interface AuthError {
  status: number;
  code?: string;
  message?: string;
}

export const TOO_MANY_REQUESTS =
  "Demasiados intentos. Espera un momento e inténtalo de nuevo.";

export function authErrorMessage(error: AuthError, fallback: string) {
  if (error.status === 429) return TOO_MANY_REQUESTS;

  return error.message ?? fallback;
}
