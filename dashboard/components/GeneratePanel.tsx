"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateTopic } from "@/lib/api";
import { useRouter } from "next/navigation";

export function GeneratePanel() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const draft = await generateTopic(t);
      setTopic("");
      router.push(`/draft/${encodeURIComponent(draft.id)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.section
      layout
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-950/40 via-zinc-900/80 to-zinc-950 p-6 shadow-2xl md:p-8"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300/90">New carousel</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">Generate from a topic</h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          AI drafts slides, renders cards, and scores the post. Open any card below to preview and send to Buffer.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="topic" className="sr-only">
              Topic
            </label>
            <input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. RAG evaluation metrics for production"
              disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none ring-indigo-500/0 transition placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading || !topic.trim()}
            whileTap={{ scale: 0.98 }}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating…
              </span>
            ) : (
              "Generate"
            )}
          </motion.button>
        </form>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 text-sm text-red-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
