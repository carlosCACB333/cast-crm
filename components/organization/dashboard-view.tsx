"use client";

import NextLink from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import {
  ChartBarIcon,
  CheckIcon,
  ContactsIcon,
  RefreshIcon,
  StagesIcon,
  TargetIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import {
  ListSkeleton,
  QueryError,
} from "@/components/organization/query-state";
import { PageHeader } from "@/components/page-header";
import {
  AppBreakdownChart,
  AppButton,
  AppDistribution,
  AppEmptyState,
  AppGauge,
  AppSkeleton,
  AppStatCard,
  AppTooltip,
  AppTrendChart,
  AppWidget,
} from "@/components/ui";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { useCustomerStats, useLeadStats } from "@/hooks/use-dashboard";
import {
  useActiveOrganization,
  useInvitationPage,
  useMemberPage,
  useMyAccess,
  usePermission,
} from "@/hooks/use-organization";
import { useMoneyFormatter } from "@/hooks/use-preferences";
import { formatMonth } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  invitationListSchema,
  memberListSchema,
} from "@/lib/validations/organization";

// Totals come from the paginated lists: the full organization only includes
// its first members.
const ALL_MEMBERS = memberListSchema.parse({});
const ALL_INVITATIONS = invitationListSchema.parse({});

const PERIOD = `Últimos ${DASHBOARD_CONFIG.trendMonths} meses`;

/** This month against the previous one, from monthly rows (oldest first). */
function lastTwo(values: number[]) {
  return {
    current: values.at(-1) ?? 0,
    previous: values.at(-2) ?? 0,
  };
}

export function DashboardView({ userName }: { userName: string }) {
  const organization = useActiveOrganization();
  const canReadCustomers = usePermission({ customer: ["read"] });
  const canReadLeads = usePermission({ lead: ["read"] });
  const customerStats = useCustomerStats({ enabled: canReadCustomers });
  const leadStats = useLeadStats({ enabled: canReadLeads });
  const money = useMoneyFormatter();
  const queryClient = useQueryClient();
  const isRefreshing = customerStats.isFetching || leadStats.isFetching;
  const firstName = userName.split(" ")[0];
  const data = organization.data;

  const customers = customerStats.data;
  const leads = leadStats.data;
  const newCustomers = customers?.months.map((row) => row.created) ?? [];
  const newLeads = leads?.months.map((row) => row.created) ?? [];
  // Running total at the end of each month, ending at the current total.
  const startTotal = (customers?.total ?? 0) - (customers?.newCount ?? 0);
  const customerTotals = newCustomers.map(
    (_, index) =>
      startTotal +
      newCustomers.slice(0, index + 1).reduce((sum, count) => sum + count, 0),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <AppTooltip content="Actualizar panel">
            <AppButton
              isIconOnly
              aria-label="Actualizar panel"
              isPending={isRefreshing}
              variant="secondary"
              onPress={() => {
                // Only the queries in use refetch, so missing permissions are
                // respected.
                for (const queryKey of [
                  queryKeys.customerStats,
                  queryKeys.leadStats,
                  queryKeys.memberPage(ALL_MEMBERS),
                  queryKeys.invitationPage(ALL_INVITATIONS),
                ]) {
                  void queryClient.invalidateQueries({ queryKey });
                }
              }}
            >
              {isRefreshing ? null : <RefreshIcon size={16} />}
            </AppButton>
          </AppTooltip>
        }
        description={
          data
            ? `Esto es lo que pasa en ${data.name}.`
            : "Cargando tu organización…"
        }
        title={`Hola, ${firstName}`}
      />

      {organization.error ? (
        <QueryError
          error={organization.error}
          onRetry={() => organization.refetch()}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canReadCustomers ? (
          <>
            <StatLink href="/customers">
              <AppStatCard
                hint={
                  customers
                    ? `+${customers.newCount} en ${PERIOD.toLowerCase()}`
                    : undefined
                }
                icon={<ContactsIcon size={16} />}
                isLoading={customerStats.isPending}
                label="Clientes totales"
                trend={customerTotals}
                value={customers?.total}
              />
            </StatLink>
            <StatLink href="/customers">
              <AppStatCard
                change={lastTwo(newCustomers)}
                hint="Frente al mes anterior"
                icon={<UsersIcon size={16} />}
                isLoading={customerStats.isPending}
                label="Clientes nuevos"
                trend={newCustomers}
                value={newCustomers.at(-1)}
              />
            </StatLink>
          </>
        ) : null}
        {canReadLeads ? (
          <>
            <StatLink href="/leads">
              <AppStatCard
                change={lastTwo(newLeads)}
                hint="Frente al mes anterior"
                icon={<TargetIcon size={16} />}
                isLoading={leadStats.isPending}
                label="Leads nuevos"
                trend={newLeads}
                value={newLeads.at(-1)}
              />
            </StatLink>
            <StatLink href="/leads">
              <AppStatCard
                hint={leads ? `${leads.openCount} leads en curso` : undefined}
                icon={<WalletIcon size={16} />}
                isLoading={leadStats.isPending}
                label="Valor en curso"
                tone="warning"
                value={leads ? money.compact(leads.openValue) : undefined}
              />
            </StatLink>
          </>
        ) : null}

        {canReadLeads ? (
          leadStats.error ? (
            <AppWidget
              className="sm:col-span-2 xl:col-span-4"
              icon={<TargetIcon size={18} />}
              title="Ventas"
            >
              <QueryError
                error={leadStats.error}
                onRetry={() => leadStats.refetch()}
              />
            </AppWidget>
          ) : (
            <>
              <AppWidget
                className="sm:col-span-2"
                description={PERIOD}
                href="/leads"
                icon={<ChartBarIcon size={18} />}
                title="Leads por mes"
              >
                {leadStats.isPending ||
                leads?.months.some((row) => row.created || row.won) ? (
                  <AppTrendChart
                    data={leads?.months ?? []}
                    formatX={formatMonth}
                    isLoading={leadStats.isPending}
                    kind="area"
                    label={`Leads creados y ganados por mes, ${PERIOD.toLowerCase()}`}
                    series={[
                      { key: "created", label: "Creados" },
                      { key: "won", label: "Ganados" },
                    ]}
                    xKey="month"
                  />
                ) : (
                  <AppEmptyState
                    description="Crea leads para ver su evolución."
                    icon={<ChartBarIcon size={20} />}
                    title="Aún no hay leads en este periodo"
                  />
                )}
              </AppWidget>
              <AppWidget
                description={PERIOD}
                href="/leads"
                icon={<TrendUpIcon size={18} />}
                title="Tasa de cierre"
              >
                <AppGauge
                  caption="Ganados"
                  isLoading={leadStats.isPending}
                  value={leads?.winRate ?? null}
                />
                <AppDistribution
                  isLoading={leadStats.isPending}
                  items={[
                    {
                      id: "won",
                      label: "Ganados",
                      value: leads?.wonCount ?? 0,
                      color: "var(--chart-1)",
                    },
                    {
                      id: "lost",
                      label: "Perdidos",
                      value: leads?.lostCount ?? 0,
                      color: "var(--chart-2)",
                    },
                  ]}
                  label="Leads cerrados como ganados y perdidos"
                />
              </AppWidget>
            </>
          )
        ) : null}

        {canReadCustomers ? (
          <AppWidget
            description="Distribución actual"
            href="/customers"
            icon={<ContactsIcon size={18} />}
            title="Clientes por estado"
          >
            {customerStats.error ? (
              <QueryError
                error={customerStats.error}
                onRetry={() => customerStats.refetch()}
              />
            ) : customerStats.isPending || customers?.total ? (
              <AppDistribution
                isLoading={customerStats.isPending}
                items={(customers?.statuses ?? []).map((status) => ({
                  id: status.id,
                  label: status.label,
                  value: status.count,
                  color: status.color,
                }))}
                label="Número de clientes en cada estado"
              />
            ) : (
              <AppEmptyState
                description="Aquí verás cuántos clientes hay en cada estado."
                icon={<ContactsIcon size={20} />}
                title="Aún no hay clientes"
              />
            )}
          </AppWidget>
        ) : null}

        {canReadLeads && !leadStats.error ? <PipelineWidget /> : null}
        <TeamWidget />
        <StepsWidget
          hasCustomers={
            canReadCustomers ? (customers?.total ?? 0) > 0 : undefined
          }
          isLoading={organization.isPending}
        />
      </div>
    </div>
  );
}

function StatLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <NextLink
      className="rounded-3xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent"
      href={href}
    >
      {children}
    </NextLink>
  );
}

function PipelineWidget() {
  const { data, isPending } = useLeadStats();
  const money = useMoneyFormatter();
  const stages = data?.pipeline?.stages ?? [];
  // Leads may not have an amount; then the stages compare how many there are.
  const byValue = stages.some((stage) => stage.value > 0);

  return (
    <AppWidget
      className="sm:col-span-2"
      description={
        data?.pipeline
          ? `${data.pipeline.name} · ${byValue ? "valor" : "leads"} por paso`
          : "Leads por paso del embudo"
      }
      href="/leads"
      icon={<StagesIcon size={18} />}
      title="Embudo"
    >
      {isPending || stages.some((stage) => stage.count) ? (
        <AppBreakdownChart
          formatValue={byValue ? money.compact : undefined}
          isLoading={isPending}
          items={stages.map((stage) => ({
            id: stage.id,
            label: stage.name,
            value: byValue ? stage.value : stage.count,
            color: stage.color,
          }))}
          label={`${byValue ? "Valor" : "Número"} de leads en cada paso del embudo`}
          valueLabel={byValue ? "Valor" : "Leads"}
        />
      ) : (
        <AppEmptyState
          description="Los leads aparecerán aquí según su paso."
          icon={<StagesIcon size={20} />}
          title="El embudo está vacío"
        />
      )}
    </AppWidget>
  );
}

function MiniStat({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: React.ReactNode;
  isLoading: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-2xl bg-accent/5 p-3">
      <span className="text-xs leading-tight font-medium text-muted">
        {label}
      </span>
      {isLoading ? (
        <AppSkeleton className="h-7 w-10 rounded-md" />
      ) : (
        <span className="truncate text-xl font-bold tabular-nums">{value}</span>
      )}
    </div>
  );
}

function TeamWidget() {
  const access = useMyAccess();
  const members = useMemberPage(ALL_MEMBERS);
  const invitations = useInvitationPage(ALL_INVITATIONS);

  return (
    <AppWidget href="/members" icon={<UsersIcon size={18} />} title="Equipo">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat
          isLoading={members.isPending}
          label="Miembros"
          value={members.data?.total}
        />
        <MiniStat
          isLoading={invitations.isPending}
          label="Invitaciones"
          value={invitations.data?.total}
        />
        <MiniStat
          isLoading={access.isPending}
          label="Tu rol"
          value={
            <span className="text-sm">{access.data?.roleLabel ?? "—"}</span>
          }
        />
      </div>
    </AppWidget>
  );
}

function StepsWidget({
  hasCustomers,
  isLoading,
}: {
  /** Undefined when the member cannot see customers. */
  hasCustomers?: boolean;
  isLoading: boolean;
}) {
  const members = useMemberPage(ALL_MEMBERS);
  const invitations = useInvitationPage(ALL_INVITATIONS);

  const steps = [
    { label: "Crea tu organización", href: "/settings", isDone: true },
    {
      label: "Invita a tu equipo",
      href: "/members",
      isDone:
        (members.data?.total ?? 0) > 1 || (invitations.data?.total ?? 0) > 0,
    },
    ...(hasCustomers !== undefined
      ? [
          {
            label: "Registra tu primer cliente",
            href: "/customers",
            isDone: hasCustomers,
          },
        ]
      : []),
    { label: "Revisa la configuración", href: "/settings", isDone: false },
  ];

  return (
    <AppWidget icon={<CheckIcon size={18} />} title="Primeros pasos">
      {isLoading ? (
        <ListSkeleton />
      ) : (
        <ol className="flex flex-col divide-y divide-separator">
          {steps.map((step) => (
            <li key={step.label}>
              <NextLink
                className="flex items-center gap-3 py-2.5 text-sm hover:text-accent"
                href={step.href}
              >
                <span
                  className={clsx(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    step.isDone
                      ? "border-transparent bg-success text-success-foreground"
                      : "border-separator text-transparent",
                  )}
                >
                  <CheckIcon size={12} strokeWidth={3} />
                </span>
                <span
                  className={clsx(step.isDone && "text-muted line-through")}
                >
                  {step.label}
                </span>
              </NextLink>
            </li>
          ))}
        </ol>
      )}
    </AppWidget>
  );
}
