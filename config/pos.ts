/**
 * Product configuration of the point of sale: tickets are invoices of the
 * sales module (channel "POS") numbered in a series of their own, sold within
 * an open cash session. Values each organization changes (ticket prefix,
 * walk-in customer name, registers, payment methods) are edited from its
 * settings; these are the defaults and limits.
 */

/** Series of the sales counter used by tickets, apart from other invoices. */
export const POS_TICKET_SERIES = "POS";

export const DEFAULT_POS_SETTINGS = {
  ticketPrefix: "TCK-",
  walkInCustomerName: "Cliente de mostrador",
};

/** Register created with every new organization. */
export const DEFAULT_CASH_REGISTER_NAME = "Caja principal";

export const CASH_MOVEMENT_TYPES = [
  { type: "IN", label: "Entrada de efectivo", short: "Entrada" },
  { type: "OUT", label: "Salida de efectivo", short: "Salida" },
] as const;

export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number]["type"];

export const CASH_MOVEMENT_TYPE_CODES = CASH_MOVEMENT_TYPES.map(
  (item) => item.type,
) as unknown as readonly [CashMovementType, ...CashMovementType[]];

export const cashMovementLabel = (type: string) =>
  CASH_MOVEMENT_TYPES.find((item) => item.type === type)?.short ?? type;

export const CASH_SESSION_STATUSES = [
  { status: "OPEN", label: "Abierta", color: "#22c55e" },
  { status: "CLOSED", label: "Cerrada", color: "#71717a" },
] as const;

export type CashSessionStatus =
  (typeof CASH_SESSION_STATUSES)[number]["status"];

export const cashSessionStatusInfo = (status: string) =>
  CASH_SESSION_STATUSES.find((item) => item.status === status) ??
  CASH_SESSION_STATUSES[1];

/** Quotes and orders that can be loaded into the till and charged. */
export const POS_LOADABLE_STATUSES = {
  QUOTE: ["DRAFT", "SENT", "ACCEPTED"],
  ORDER: ["DRAFT", "CONFIRMED"],
} as const;

export const POS_LIMITS = {
  /** Products and services shown per page of the catalog grid. */
  itemsPageSize: 24,
  maxRegisters: 50,
  maxRegisterNameLength: 40,
  maxPaymentsPerTicket: 5,
  maxReasonLength: 200,
  maxClosingNotesLength: 1000,
  maxWalkInNameLength: 80,
  sessionsPageSize: 20,
  /** Tickets and invoice payments listed in a session. */
  sessionRows: 200,
  /** Carts parked at the same time in the organization. */
  maxHeldCarts: 50,
  maxHeldCartNoteLength: 60,
};
