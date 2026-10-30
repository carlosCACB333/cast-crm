export const queryKeys = {
  organizations: ["organizations"] as const,
  organizationCreation: ["organizations", "creation"] as const,
  activeOrganization: ["organizations", "active"] as const,
  activeMember: ["organizations", "active", "member"] as const,
  myAccess: ["organizations", "active", "access"] as const,
  roles: ["organizations", "active", "roles"] as const,
  // Pages live under the organization keys so any organization mutation
  // (the default invalidation) refreshes them.
  memberPage: (params: Record<string, unknown>) =>
    ["organizations", "active", "members", params] as const,
  invitationPage: (params: Record<string, unknown>) =>
    ["organizations", "active", "invitations", params] as const,
  rolePage: (params: Record<string, unknown>) =>
    ["organizations", "active", "roles", "page", params] as const,
  // Options of the searchable selects live under the keys of their data, so
  // the mutations that already refresh that data refresh them too.
  memberOptions: ["organizations", "active", "members", "options"] as const,
  roleOptions: (purpose: string) =>
    ["organizations", "active", "roles", "options", purpose] as const,
  profile: ["profile"] as const,
  sessions: ["profile", "sessions"] as const,
  customers: ["customers"] as const,
  customerList: (filters: Record<string, unknown>) =>
    ["customers", "list", filters] as const,
  customer: (id: string) => ["customers", "detail", id] as const,
  customerNotes: (id: string) => ["customers", "notes", id] as const,
  customerStats: ["customers", "stats"] as const,
  customerStatuses: ["customers", "statuses"] as const,
  customerStatusOptions: ["customers", "statuses", "options"] as const,
  customerTagOptions: ["customers", "tags", "options"] as const,
  preferences: ["organizations", "active", "preferences"] as const,
  taxes: ["organizations", "active", "taxes"] as const,
  leads: ["leads"] as const,
  leadStats: ["leads", "stats"] as const,
  pipelines: ["leads", "pipelines"] as const,
  pipeline: (id: string) => ["leads", "pipelines", "detail", id] as const,
  pipelinePage: (params: Record<string, unknown>) =>
    ["leads", "pipelines", "page", params] as const,
  leadTagOptions: ["leads", "tags", "options"] as const,
  pipelineOptions: ["leads", "pipelines", "options"] as const,
  stageOptions: (pipelineId: string) =>
    ["leads", "pipelines", "options", "stages", pipelineId] as const,
  leadBoard: (filters: Record<string, unknown>) =>
    ["leads", "board", filters] as const,
  lead: (id: string) => ["leads", "detail", id] as const,
  leadNotes: (id: string) => ["leads", "notes", id] as const,
  customerLeads: (params: { customerId: string } & Record<string, unknown>) =>
    ["leads", "customer", params.customerId, params] as const,
  products: ["products"] as const,
  productList: (filters: Record<string, unknown>) =>
    ["products", "list", filters] as const,
  product: (id: string) => ["products", "detail", id] as const,
  productBarcodeLookup: (barcode: string) =>
    ["products", "barcode", barcode] as const,
  stockMovements: (params: { productId: string } & Record<string, unknown>) =>
    ["products", "movements", params.productId, params] as const,
  productCategories: ["products", "categories"] as const,
  productCategoryOptions: ["products", "categories", "options"] as const,
  productTagOptions: ["products", "tags", "options"] as const,
  services: ["services"] as const,
  serviceList: (filters: Record<string, unknown>) =>
    ["services", "list", filters] as const,
  service: (id: string) => ["services", "detail", id] as const,
  serviceCategories: ["services", "categories"] as const,
  serviceCategoryOptions: ["services", "categories", "options"] as const,
  serviceTagOptions: ["services", "tags", "options"] as const,
  customerOptions: ["customers", "options"] as const,
  sales: ["sales"] as const,
  salesList: (filters: Record<string, unknown>) =>
    ["sales", "list", filters] as const,
  salesDocument: (id: string) => ["sales", "detail", id] as const,
  salesOverview: ["sales", "overview"] as const,
  customerSales: (params: { customerId: string } & Record<string, unknown>) =>
    ["sales", "customer", params.customerId, params] as const,
  // Products and services offered in document lines.
  salesItemOptions: ["sales", "items", "options"] as const,
  salesSettings: ["organizations", "active", "sales-settings"] as const,
  // Organization configuration: the default invalidation refreshes them.
  paymentMethods: ["organizations", "active", "payment-methods"] as const,
  paymentMethodOptions: [
    "organizations",
    "active",
    "payment-methods",
    "options",
  ] as const,
  posSettings: ["organizations", "active", "pos-settings"] as const,
  // Point of sale data lives under the sales keys: tickets and payments are
  // sales documents, so sales mutations refresh the till and vice versa.
  pos: ["sales", "pos"] as const,
  posState: ["sales", "pos", "state"] as const,
  salesCatalogItem: (ref: string) => ["sales", "catalog-item", ref] as const,
  heldCarts: ["sales", "pos", "held-carts"] as const,
  posItems: (params: Record<string, unknown>) =>
    ["sales", "pos", "items", params] as const,
  cashRegisters: ["sales", "pos", "registers"] as const,
  cashRegisterOptions: ["sales", "pos", "registers", "options"] as const,
  cashSessionList: (filters: Record<string, unknown>) =>
    ["sales", "pos", "sessions", "list", filters] as const,
  cashSession: (id: string) =>
    ["sales", "pos", "sessions", "detail", id] as const,
  posSourceOptions: ["sales", "pos", "sources", "options"] as const,
  pendingInvoiceOptions: ["sales", "pos", "invoices", "options"] as const,
  userInvitations: ["invitations", "user"] as const,
  invitation: (id: string) => ["invitations", id] as const,
};
