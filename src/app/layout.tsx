import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { CompareTray } from "@/components/compare-tray";
import { MobileBar, Sidebar, type Pulse } from "@/components/sidebar";

export const metadata: Metadata = {
  title: { default: "OneAtlas — AI model discovery & intelligence", template: "%s · OneAtlas" },
  description:
    "Discover, compare and evaluate AI models across labs and providers, with real pricing, context windows and benchmarks.",
};

function timeAgo(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

async function getPulse(): Promise<Pulse> {
  try {
    const [models, endpoints, last] = await Promise.all([
      prisma.model.count(),
      prisma.modelEndpoint.count(),
      prisma.ingestionRun.findFirst({ where: { status: { in: ["success", "partial"] } }, orderBy: { finishedAt: "desc" } }),
    ]);
    return { models, endpoints, lastSync: last?.finishedAt ? timeAgo(last.finishedAt) : null };
  } catch {
    return { models: 0, endpoints: 0, lastSync: null }; // never let the shell crash on a DB hiccup
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pulse = await getPulse();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Sidebar pulse={pulse} />
        <MobileBar />
        <div className="lg:pl-60">
          <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
          <footer className="mx-auto max-w-6xl border-t border-zinc-800 px-4 py-8 text-sm text-zinc-500 md:px-8">
            Data synced from the{" "}
            <a className="underline hover:text-zinc-300" href="https://openrouter.ai/docs/api-reference/list-available-models">OpenRouter models API</a>,{" "}
            <a className="underline hover:text-zinc-300" href="https://github.com/BerriAI/litellm">LiteLLM pricing map</a> and{" "}
            <a className="underline hover:text-zinc-300" href="https://aider.chat/docs/leaderboards/">Aider leaderboards</a>. Every record links to its source.
          </footer>
        </div>
        <CompareTray />
      </body>
    </html>
  );
}
