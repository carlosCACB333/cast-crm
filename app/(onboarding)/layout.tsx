import NextLink from "next/link";

import { Logo } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <NextLink className="flex items-center gap-2" href="/">
          <Logo size={32} />
          <span className="font-semibold">Cast CRM</span>
        </NextLink>
        <ThemeSwitch />
      </header>
      <main className="relative flex flex-1 justify-center px-4 pb-12 pt-4 sm:px-10 sm:pt-10">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
