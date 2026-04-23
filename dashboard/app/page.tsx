"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchConfig, fetchDrafts, type AppConfig, type DraftListItem } from "@/lib/api";
import { SetupBanner } from "@/components/SetupBanner";
import { DraftCard } from "@/components/DraftCard";
import { GeneratePanel } from "@/components/GeneratePanel";

export default function DashboardPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  async function load() {
    setLoadErr(null);
    try {
      const [c, d] = await Promise.all([fetchConfig(), fetchDrafts()]);
      setConfig(c);
      setDrafts(d);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load dashboard");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="bg-grid min-h-screen">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg">
              CS
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Instagram AI</p>
              <h1 className="text-lg font-semibold text-white">Carousel Studio</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="hidden sm:inline">API :3000</span>
            <Link
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:border-indigo-500/40 hover:text-white"
            >
              Health
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {loadErr && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {loadErr}
            <p className="mt-2 text-xs text-red-300/80">
              Start the backend: <code className="rounded bg-black/30 px-1">npm run api:dev</code> then refresh (or{" "}
              <code className="rounded bg-black/30 px-1">npm run dev:all</code> for backend + this UI).
            </p>
          </div>
        )}

        <SetupBanner config={config} />

        <GeneratePanel />

        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Your generations</h2>
              <p className="mt-1 text-sm text-zinc-500">Open a card to preview slides and schedule to Buffer.</p>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => void load()}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-indigo-500/40 hover:text-white"
            >
              Refresh
            </motion.button>
          </div>

          {drafts.length === 0 && !loadErr ? (
            <p className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">
              No drafts yet. Generate your first carousel above.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((d, i) => (
                <DraftCard key={d.id} draft={d} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
