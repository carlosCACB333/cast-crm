import { redirect } from "next/navigation";
import NextLink from "next/link";

import { CheckIcon, Logo } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";
import { AppCard } from "@/components/ui";
import { getSession } from "@/lib/session";

const highlights = [
  "Clientes, oportunidades y tareas en un solo lugar",
  "Equipos y organizaciones con permisos por módulo",
  "Adaptable a cualquier tipo de negocio",
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (session) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-separator bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-0 size-[24rem] rounded-full bg-accent/10 blur-3xl"
        />

        <NextLink className="relative flex items-center gap-2" href="/">
          <Logo />
          <span className="text-lg font-semibold">Cast CRM</span>
        </NextLink>

        <div className="relative flex max-w-md flex-col gap-8">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Todas tus relaciones comerciales,{" "}
            <span className="text-accent">en orden.</span>
          </h2>
          <ul className="flex flex-col gap-4">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-muted">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <CheckIcon size={12} strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-muted">
          © {new Date().getFullYear()} Cast CRM
        </p>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <NextLink className="flex items-center gap-2 lg:invisible" href="/">
            <Logo size={32} />
            <span className="font-semibold">Cast CRM</span>
          </NextLink>
          <ThemeSwitch />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-10">
          <AppCard className="max-w-[420px] lg:p-8">{children}</AppCard>
        </main>
      </div>
    </div>
  );
}
