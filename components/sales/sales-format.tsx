import type { SalesDocumentType, SalesStatus } from "@/config/sales";

import clsx from "clsx";

import {
  ClipboardIcon,
  FileTextIcon,
  ReceiptIcon,
  TruckIcon,
} from "@/components/icons";
import { AppStatusChip } from "@/components/ui";
import { SALES_TYPES, salesStatusInfo } from "@/config/sales";
import { isPastDay } from "@/lib/format";

export { formatDay, formatRelative } from "@/lib/format";

export const SALES_TYPE_ICONS: Record<
  SalesDocumentType,
  React.FC<{ size?: number; className?: string }>
> = {
  QUOTE: FileTextIcon,
  ORDER: ClipboardIcon,
  DELIVERY_NOTE: TruckIcon,
  INVOICE: ReceiptIcon,
};

export function SalesStatusChip({
  type,
  status,
}: {
  type: SalesDocumentType;
  status: SalesStatus;
}) {
  const info = salesStatusInfo(type, status);

  return <AppStatusChip color={info.color} label={info.label} />;
}

/** Number of a document; draft invoices get theirs when issued. */
export const salesNumber = (document: {
  number: string | null;
  type: SalesDocumentType;
}) => document.number ?? `${SALES_TYPES[document.type].label} en borrador`;

/** Issued invoice past its due date and not fully paid. */
export const isSalesOverdue = (document: {
  type: SalesDocumentType;
  status: SalesStatus;
  dueDate: string | null;
}) =>
  document.type === "INVOICE" &&
  document.status === "ISSUED" &&
  Boolean(document.dueDate && isPastDay(document.dueDate));

/** Rounded square with the icon of the document type. */
export function SalesTypeBadge({
  type,
  size = "sm",
}: {
  type: SalesDocumentType;
  size?: "sm" | "lg";
}) {
  const Icon = SALES_TYPE_ICONS[type];

  return (
    <span
      aria-hidden
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent",
        size === "lg" ? "size-14" : "size-9",
      )}
    >
      <Icon size={size === "lg" ? 26 : 18} />
    </span>
  );
}
