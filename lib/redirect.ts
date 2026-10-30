/** Only allows same-origin relative paths to avoid open redirects. */
export function safeRedirectPath(
  value: string | undefined,
  fallback = "/dashboard",
) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
    ? value
    : fallback;
}
