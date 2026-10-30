import type { OptionPage } from "@/lib/actions/options";
import type { ActionResult } from "@/lib/actions/result";

import {
  searchCashRegisterOptions,
  searchCustomerOptions,
  searchCustomerStatusOptions,
  searchCustomerTagOptions,
  searchLeadTagOptions,
  searchMemberOptions,
  searchPaymentMethodOptions,
  searchPendingInvoiceOptions,
  searchPipelineOptions,
  searchProductCategoryOptions,
  searchProductTagOptions,
  searchServiceCategoryOptions,
  searchServiceTagOptions,
  searchPosSourceOptions,
  searchRoleOptions,
  searchSalesItemOptions,
  searchStageOptions,
} from "@/lib/actions/options";
import { salesDocumentHref, salesItemHref } from "@/config/sales";
import { queryKeys } from "@/lib/query-keys";

/**
 * Server-side options of a searchable select (`AppAutocomplete`): searched
 * and paginated by a Server Action, cached under `key`.
 */
export interface OptionSource {
  key: readonly unknown[];
  search: (params: {
    q: string;
    page: number;
    ids?: string[];
  }) => Promise<ActionResult<OptionPage>>;
  /**
   * Pages to open next to the field: the list while nothing is selected and
   * the selected record's detail (or the list when it has none).
   */
  links?: OptionSourceLinks;
}

export interface OptionSourceLinks {
  list: string;
  /** Plural shown in "Ver clientes". */
  listLabel: string;
  item?: (value: string) => string | null;
}

export const optionSources = {
  /** Members; the value is the user id (owner fields). */
  members: {
    key: queryKeys.memberOptions,
    search: searchMemberOptions,
    links: { list: "/members", listLabel: "miembros" },
  },
  roles: (purpose: "filter" | "invite" | "assign"): OptionSource => ({
    key: queryKeys.roleOptions(purpose),
    search: (params) => searchRoleOptions({ ...params, purpose }),
  }),
  customers: {
    key: queryKeys.customerOptions,
    search: searchCustomerOptions,
    links: {
      list: "/customers",
      listLabel: "clientes",
      item: (id) => `/customers/${id}`,
    },
  },
  /** Active products and services; the value is "product:<id>" or "service:<id>". */
  salesItems: {
    key: queryKeys.salesItemOptions,
    search: searchSalesItemOptions,
    links: { list: "/products", listLabel: "productos", item: salesItemHref },
  },
  /** Active payment methods of the organization; the value is their id. */
  paymentMethods: {
    key: queryKeys.paymentMethodOptions,
    search: searchPaymentMethodOptions,
    links: { list: "/sales/payment-methods", listLabel: "formas de pago" },
  },
  /** Active cash registers of the point of sale. */
  cashRegisters: {
    key: queryKeys.cashRegisterOptions,
    search: searchCashRegisterOptions,
    links: { list: "/pos/registers", listLabel: "cajas" },
  },
  /** Open quotes and orders that can be charged at the till. */
  posSources: {
    key: queryKeys.posSourceOptions,
    search: searchPosSourceOptions,
  },
  /** Issued invoices with something left to collect. */
  pendingInvoices: {
    key: queryKeys.pendingInvoiceOptions,
    search: searchPendingInvoiceOptions,
    links: {
      list: "/sales/invoices",
      listLabel: "facturas",
      item: (id) => salesDocumentHref("INVOICE", id),
    },
  },
  customerStatuses: {
    key: queryKeys.customerStatusOptions,
    search: searchCustomerStatusOptions,
    links: { list: "/customers/statuses", listLabel: "estados" },
  },
  customerTags: {
    key: queryKeys.customerTagOptions,
    search: searchCustomerTagOptions,
  },
  leadTags: {
    key: queryKeys.leadTagOptions,
    search: searchLeadTagOptions,
  },
  productCategories: {
    key: queryKeys.productCategoryOptions,
    search: searchProductCategoryOptions,
    links: { list: "/products/categories", listLabel: "categorías" },
  },
  productTags: {
    key: queryKeys.productTagOptions,
    search: searchProductTagOptions,
  },
  serviceCategories: {
    key: queryKeys.serviceCategoryOptions,
    search: searchServiceCategoryOptions,
    links: { list: "/services/categories", listLabel: "categorías" },
  },
  serviceTags: {
    key: queryKeys.serviceTagOptions,
    search: searchServiceTagOptions,
  },
  pipelines: {
    key: queryKeys.pipelineOptions,
    search: searchPipelineOptions,
    links: { list: "/leads/pipelines", listLabel: "embudos" },
  },
  stages: (pipelineId: string): OptionSource => ({
    key: queryKeys.stageOptions(pipelineId),
    search: (params) => searchStageOptions({ ...params, pipelineId }),
  }),
} satisfies Record<string, OptionSource | ((...args: never[]) => OptionSource)>;
