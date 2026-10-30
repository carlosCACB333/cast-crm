"use client";

import type { SalesChainItem } from "@/lib/actions/sales";
import type { SalesDocumentType } from "@/config/sales";

import NextLink from "next/link";
import clsx from "clsx";

import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import {
  SALES_TYPE_ICONS,
  SalesStatusChip,
} from "@/components/sales/sales-format";
import { AppButton } from "@/components/ui";
import { SALES_TYPE_LIST, salesDocumentHref } from "@/config/sales";
import { useMoneyFormatter } from "@/hooks/use-preferences";

/**
 * The steps of the sale (quote → order → delivery note → invoice) with the
 * documents of this sale in each one. Steps that were skipped stay empty;
 * the next ones offer to create them from the current document.
 */
export function SalesFlow({
  currentId,
  chain,
  conversions,
  isConverting,
  onConvert,
}: {
  currentId: string;
  chain: SalesChainItem[];
  /** Types the current document can be turned into. */
  conversions: SalesDocumentType[];
  isConverting: boolean;
  onConvert: (target: SalesDocumentType) => void;
}) {
  const money = useMoneyFormatter();

  return (
    <nav aria-label="Flujo de la venta">
      <ol className="grid gap-3 md:grid-cols-4">
        {SALES_TYPE_LIST.map((definition, index) => {
          const documents = chain.filter(
            (item) => item.type === definition.type,
          );
          const hasCurrent = documents.some((item) => item.id === currentId);
          const canCreate = conversions.includes(definition.type);
          const Icon = SALES_TYPE_ICONS[definition.type];

          return (
            <li key={definition.type} className="relative flex min-w-0">
              <div
                className={clsx(
                  "flex w-full min-w-0 flex-col gap-2 rounded-2xl border p-3 transition-colors",
                  hasCurrent
                    ? "border-accent bg-accent/5"
                    : documents.length
                      ? "border-separator"
                      : "border-dashed border-separator",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      documents.length
                        ? "bg-accent/10 text-accent"
                        : "bg-default text-muted",
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  <span
                    className={clsx(
                      "truncate text-sm font-medium",
                      !documents.length && "text-muted",
                    )}
                  >
                    {definition.short}
                  </span>
                </div>

                {documents.length ? (
                  <ul className="flex flex-col gap-1">
                    {documents.map((item) => (
                      <li key={item.id}>
                        <NextLink
                          aria-current={
                            item.id === currentId ? "page" : undefined
                          }
                          className={clsx(
                            "flex flex-col gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-accent",
                            item.id === currentId && "bg-default/70",
                          )}
                          href={salesDocumentHref(item.type, item.id)}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium tabular-nums">
                              {item.number ?? "Borrador"}
                            </span>
                            <span className="text-xs text-muted tabular-nums">
                              {money.format(item.total)}
                            </span>
                          </span>
                          <SalesStatusChip
                            status={item.status}
                            type={item.type}
                          />
                        </NextLink>
                      </li>
                    ))}
                  </ul>
                ) : canCreate ? (
                  <AppButton
                    isDisabled={isConverting}
                    size="sm"
                    variant="secondary"
                    onPress={() => onConvert(definition.type)}
                  >
                    <PlusIcon size={14} />
                    Crear {definition.label.toLowerCase()}
                  </AppButton>
                ) : (
                  <span className="px-2 text-xs text-muted">Sin documento</span>
                )}
              </div>
              {index < SALES_TYPE_LIST.length - 1 ? (
                <ChevronRightIcon
                  aria-hidden
                  className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 text-muted md:block"
                  size={16}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
