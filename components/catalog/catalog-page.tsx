"use client";

import NextLink from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { AppEmptyState, AppSkeleton } from "@/components/ui";

// Page pieces shared by the catalog modules (products, services).

export function CatalogBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <NextLink
      className="inline-flex w-fit max-w-full items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      href={href}
    >
      <ArrowLeftIcon size={16} />
      <span className="truncate">{label}</span>
    </NextLink>
  );
}

/** Shown instead of a page the member has no permission for. */
export function CatalogNoAccess({
  title,
  backHref,
  backLabel,
  icon,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CatalogBackLink href={backHref} label={backLabel} />
      <AppEmptyState
        description="Pide a un administrador que te dé acceso."
        icon={icon}
        title={title}
      />
    </div>
  );
}

/** Placeholder of a two-column form page while its data loads. */
export function CatalogFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <AppSkeleton className="h-4 w-24 rounded-lg" />
      <AppSkeleton className="h-8 w-64 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <AppSkeleton className="h-96 rounded-3xl lg:col-span-2" />
        <AppSkeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}
