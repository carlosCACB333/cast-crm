import type { LeadCard as LeadCardData } from "@/lib/actions/leads";

import clsx from "clsx";

import { AppAvatar, AppChip } from "@/components/ui";
import { formatDay, isPastDay } from "@/lib/format";

export function LeadCard({
  lead,
  isOpen,
  formatMoney,
}: {
  lead: LeadCardData;
  /** Whether the lead is in an open stage (overdue dates only matter then). */
  isOpen: boolean;
  formatMoney: (value: number) => string;
}) {
  const subtitle = [lead.companyName, lead.contactName]
    .filter(Boolean)
    .join(" · ");
  const isOverdue =
    isOpen &&
    lead.expectedCloseDate !== null &&
    isPastDay(lead.expectedCloseDate);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 flex-col pr-5">
        <span className="line-clamp-2 font-medium">{lead.title}</span>
        {subtitle ? (
          <span className="truncate text-xs text-muted">{subtitle}</span>
        ) : null}
      </div>

      {lead.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {lead.tags.slice(0, 2).map((tag) => (
            <AppChip key={tag}>{tag}</AppChip>
          ))}
          {lead.tags.length > 2 ? (
            <AppChip>+{lead.tags.length - 2}</AppChip>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold tabular-nums">
          {lead.value !== null ? (
            formatMoney(lead.value)
          ) : (
            <span className="font-normal text-muted">Sin valor</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {lead.expectedCloseDate ? (
            <span
              className={clsx(
                "text-xs whitespace-nowrap",
                isOverdue ? "font-medium text-danger" : "text-muted",
              )}
              title={isOverdue ? "Fecha de cierre vencida" : "Cierre previsto"}
            >
              {formatDay(lead.expectedCloseDate)}
            </span>
          ) : null}
          {lead.owner ? (
            <AppAvatar
              className="size-6 text-[10px]"
              name={lead.owner.name}
              size="sm"
              src={lead.owner.image}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
