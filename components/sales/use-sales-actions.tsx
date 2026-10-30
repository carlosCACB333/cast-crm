"use client";

import type {
  SalesDocumentType,
  SalesStatus,
  SalesTransition,
} from "@/config/sales";
import type { AppDropdownItem } from "@/components/ui";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowRightIcon,
  CopyIcon,
  PencilIcon,
  PrinterIcon,
  RefreshIcon,
  TrashIcon,
} from "@/components/icons";
import { salesNumber } from "@/components/sales/sales-format";
import { AppConfirm, notify } from "@/components/ui";
import {
  SALES_TYPES,
  canConvertSales,
  salesDocumentHref,
} from "@/config/sales";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePermission } from "@/hooks/use-organization";
import {
  convertSalesDocument,
  deleteSalesDocument,
  duplicateSalesDocument,
  setSalesDocumentStatus,
} from "@/lib/actions/sales";
import { queryKeys } from "@/lib/query-keys";

export interface SalesActionTarget {
  id: string;
  type: SalesDocumentType;
  status: SalesStatus;
  number: string | null;
}

type Pending =
  | { kind: "delete"; document: SalesActionTarget }
  | {
      kind: "status";
      document: SalesActionTarget;
      transition: SalesTransition;
    };

export const salesPrintHref = (id: string) => `/print/sales/${id}`;

/**
 * Everything a member can do with a sales document (move its status, turn it
 * into the next step, duplicate, print, delete), shared by the list and the
 * detail page. Destructive moves ask for confirmation in `dialog`.
 */
export function useSalesActions({
  onDeleted,
}: { onDeleted?: (document: SalesActionTarget) => void } = {}) {
  const router = useRouter();
  const canCreate = usePermission({ sale: ["create"] });
  const canUpdate = usePermission({ sale: ["update"] });
  const canDelete = usePermission({ sale: ["delete"] });
  const [pending, setPending] = useState<Pending>();

  // Delivered delivery notes move stock, so products are refreshed too.
  const invalidate = [queryKeys.sales, queryKeys.products];
  const setStatus = useActionMutation(setSalesDocumentStatus, { invalidate });
  const convert = useActionMutation(convertSalesDocument, { invalidate });
  const duplicate = useActionMutation(duplicateSalesDocument, {
    successMessage: "Documento duplicado",
    invalidate,
  });
  const remove = useActionMutation(deleteSalesDocument, { invalidate });

  const transitions = (document: SalesActionTarget) =>
    canUpdate
      ? (SALES_TYPES[document.type].transitions[document.status] ?? [])
      : [];

  const conversions = (document: SalesActionTarget) =>
    canCreate
      ? SALES_TYPES[document.type].convertsTo.filter((target) =>
          canConvertSales(document.type, document.status, target),
        )
      : [];

  const isEditable = (document: SalesActionTarget) =>
    canUpdate &&
    SALES_TYPES[document.type].editableStatuses.includes(document.status);

  const isDeletable = (document: SalesActionTarget) =>
    canDelete &&
    SALES_TYPES[document.type].deletableStatuses.includes(document.status);

  const changeStatus = (
    document: SalesActionTarget,
    transition: SalesTransition,
  ) =>
    setStatus.mutate(
      { id: document.id, status: transition.to },
      {
        onSuccess: () => {
          setPending(undefined);
          notify.success(
            `${SALES_TYPES[document.type].label}: ${transition.label.toLowerCase()}`,
          );
        },
      },
    );

  const convertTo = (document: SalesActionTarget, target: SalesDocumentType) =>
    convert.mutate(
      { id: document.id, target },
      {
        onSuccess: (created) => {
          notify.success(SALES_TYPES[created.type].createdMessage);
          router.push(salesDocumentHref(created.type, created.id));
        },
      },
    );

  /** Menu items for a document; `exclude` leaves out the ones already shown as buttons. */
  const items = (
    document: SalesActionTarget,
    {
      exclude = [],
      withOpen = false,
    }: { exclude?: string[]; withOpen?: boolean } = {},
  ): AppDropdownItem[] =>
    [
      ...(withOpen
        ? [
            {
              id: "open",
              label: "Ver documento",
              icon: <ArrowRightIcon size={16} />,
            },
          ]
        : []),
      ...(isEditable(document)
        ? [{ id: "edit", label: "Editar", icon: <PencilIcon size={16} /> }]
        : []),
      ...transitions(document).map((transition) => ({
        id: `status:${transition.to}`,
        label: transition.label,
        icon: <RefreshIcon size={16} />,
        isDanger: transition.isDanger,
      })),
      ...conversions(document).map((target) => ({
        id: `convert:${target}`,
        label: `Crear ${SALES_TYPES[target].label.toLowerCase()}`,
        description: "Con el mismo cliente y las mismas líneas",
        icon: <ArrowRightIcon size={16} />,
      })),
      ...(canCreate
        ? [{ id: "duplicate", label: "Duplicar", icon: <CopyIcon size={16} /> }]
        : []),
      { id: "print", label: "Imprimir o PDF", icon: <PrinterIcon size={16} /> },
      ...(isDeletable(document)
        ? [
            {
              id: "delete",
              label: "Eliminar",
              icon: <TrashIcon size={16} />,
              isDanger: true,
            },
          ]
        : []),
    ].filter((item) => !exclude.includes(item.id));

  const run = (document: SalesActionTarget, id: string) => {
    if (id === "open") {
      router.push(salesDocumentHref(document.type, document.id));
    } else if (id === "edit") {
      router.push(`${salesDocumentHref(document.type, document.id)}/edit`);
    } else if (id === "print") {
      window.open(salesPrintHref(document.id), "_blank", "noopener");
    } else if (id === "duplicate") {
      duplicate.mutate(document.id, {
        onSuccess: ({ id: copyId }) =>
          router.push(salesDocumentHref(document.type, copyId)),
      });
    } else if (id === "delete") {
      setPending({ kind: "delete", document });
    } else if (id.startsWith("status:")) {
      const transition = transitions(document).find(
        (item) => `status:${item.to}` === id,
      );

      if (!transition) return;
      if (transition.isDanger) {
        setPending({ kind: "status", document, transition });
      } else {
        changeStatus(document, transition);
      }
    } else if (id.startsWith("convert:")) {
      convertTo(document, id.slice("convert:".length) as SalesDocumentType);
    }
  };

  const target = pending?.document;
  const label = target ? SALES_TYPES[target.type].label.toLowerCase() : "";
  const dialog = (
    <AppConfirm
      confirmLabel={
        pending?.kind === "status" ? pending.transition.label : "Eliminar"
      }
      description={
        !target
          ? ""
          : pending?.kind === "delete"
            ? `Se eliminará ${label} ${salesNumber(target)} con sus líneas. Los documentos creados a partir de él se conservan. Esta acción no se puede deshacer.`
            : target.type === "DELIVERY_NOTE" && target.status === "DELIVERED"
              ? `El albarán ${salesNumber(target)} dejará de contar como entregado y, si salió del stock, las unidades volverán al inventario.`
              : `${SALES_TYPES[target.type].label} ${salesNumber(target)}: ${pending?.kind === "status" ? pending.transition.label.toLowerCase() : ""}. Podrás reabrirlo si te equivocas, salvo en facturas anuladas.`
      }
      isOpen={Boolean(pending)}
      isPending={remove.isPending || setStatus.isPending}
      title={
        pending?.kind === "status"
          ? pending.transition.label
          : `Eliminar ${label}`
      }
      onConfirm={() => {
        if (!pending) return;
        if (pending.kind === "status") {
          changeStatus(pending.document, pending.transition);
        } else {
          remove.mutate(pending.document.id, {
            onSuccess: () => {
              notify.success(SALES_TYPES[pending.document.type].deletedMessage);
              setPending(undefined);
              onDeleted?.(pending.document);
            },
          });
        }
      }}
      onOpenChange={(isOpen) => !isOpen && setPending(undefined)}
    />
  );

  return {
    items,
    run,
    dialog,
    transitions,
    conversions,
    isEditable,
    convertTo,
    changeStatus: (document: SalesActionTarget, transition: SalesTransition) =>
      run(document, `status:${transition.to}`),
    isBusy:
      setStatus.isPending ||
      convert.isPending ||
      duplicate.isPending ||
      remove.isPending,
  };
}
