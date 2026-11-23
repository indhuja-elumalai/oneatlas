import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { CommandPalette } from "@/components/command-palette";
import { CompareTray } from "@/components/compare-tray";
import { MobileNav, NavLinks } from "@/components/nav-links";

export const metadata: Metadata = {
  title: { default: "OneAtlas — AI model discovery & intelligence", template: "%s · OneAtlas" },
  description:
    "Discover, compare and evaluate AI models across labs and providers, with real pricing, context windows and benchmarks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-bold text-zinc-950">◎</span>
              OneAtlas
            </Link>
            <NavLinks />
            <div className="ml-auto">
              <CommandPalette />
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-4 pb-2 md:hidden">
            <MobileNav />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <CompareTray />
        <footer className="mt-16 border-t border-zinc-800 py-8 text-sm text-zinc-500">
          <div className="mx-auto max-w-7xl px-4">
            Data synced from the{" "}
            <a className="underline hover:text-zinc-300" href="https://openrouter.ai/docs/api-reference/list-available-models">OpenRouter models API</a>,{" "}
            <a className="underline hover:text-zinc-300" href="https://github.com/BerriAI/litellm">LiteLLM pricing map</a> and{" "}
            <a className="underline hover:text-zinc-300" href="https://aider.chat/docs/leaderboards/">Aider leaderboards</a>. Every record links to its source.
          </div>
        </footer>
      </body>
    </html>
  );
}
