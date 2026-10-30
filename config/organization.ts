/**
 * Regional preferences an organization can change from its settings. The
 * selected values are stored on the organization; these are the options.
 */

export const CURRENCIES = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "Dólar estadounidense (USD)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "GBP", label: "Libra esterlina (GBP)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CURRENCY_CODES = CURRENCIES.map(
  (currency) => currency.code,
) as unknown as readonly [CurrencyCode, ...CurrencyCode[]];

export const DEFAULT_CURRENCY: CurrencyCode = "EUR";

/** Locale used to format dates and numbers in the app. */
export const APP_LOCALE = "es";

/** Image formats accepted for the organization's avatar. */
export const ORGANIZATION_LOGO_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
] as const;

export const ORGANIZATION_LOGO_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  /** Side in pixels of the square the avatar is cropped to when delivered. */
  size: 256,
} as const;
