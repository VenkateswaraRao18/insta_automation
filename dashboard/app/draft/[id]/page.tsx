"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { addHours } from "date-fns";
import { fetchDraft, scheduleDraft, type DraftDetail } from "@/lib/api";

function BufferSummary({ buffer }: { buffer: Record<string, unknown> }) {
  const ids =
    Array.isArray(buffer.updateIds) && buffer.updateIds.length > 0
      ? (buffer.updateIds as string[]).join(", ")
      : String(buffer.updateId || "—");
  return <p className="text-xs text-emerald-400/90">Buffer update id(s): {ids}</p>;
}

function defaultScheduleLocal() {
  const d = addHours(new Date(), 2);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DraftPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id || ""));

  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduleLocal, setScheduleLocal] = useState(defaultScheduleLocal);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const d = await fetchDraft(id);
        if (!cancelled) setDraft(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const captionPreview = useMemo(() => {
    if (!draft?.content) return "";
    const c = draft.content as { caption?: string; hashtags?: string[] };
    const tags = Array.isArray(c.hashtags) ? c.hashtags.join(" ") : "";
    return `${c.caption || ""}\n\n${tags}`.trim();
  }, [draft]);

  async function onSchedule() {
    if (!draft) return;
    setScheduling(true);
    setScheduleMsg(null);
    try {
      const scheduledAt = new Date(scheduleLocal).toISOString();
      const { post } = await scheduleDraft(draft.id, scheduledAt);
      setDraft(post);
      setScheduleMsg("Scheduled to Buffer successfully.");
    } catch (e) {
      setScheduleMsg(e instanceof Error ? e.message : "Schedule failed");
    } finally {
      setScheduling(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{error}</p>
        <Link href="/" className="text-indigo-400 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
            ← Dashboard
          </Link>
          <span className="truncate text-xs text-zinc-500 md:text-sm">{draft.topic}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:flex md:gap-8 md:px-6 md:py-10">
        <section className="md:flex-1">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Slides</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible">
            {draft.imageUrls.map((url, i) => (
              <motion.div
                key={url + i}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="w-[min(100%,280px)] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl md:w-[calc(50%-6px)] lg:w-[calc(33.33%-8px)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Slide ${i + 1}`} className="aspect-square w-full object-cover" />
                <p className="border-t border-white/5 px-2 py-1 text-center text-xs text-zinc-500">{i + 1}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <aside className="md:w-96 md:shrink-0">
          <div className="sticky top-20 space-y-6 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-xl">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Caption & hashtags</h3>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-zinc-300">
                {captionPreview || "—"}
              </pre>
            </div>
            {draft.scores?.average != null && (
              <p className="text-sm text-zinc-400">
                Eval score: <span className="font-semibold text-indigo-300">{draft.scores.average.toFixed(2)}</span>
              </p>
            )}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Schedule</label>
              <input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <motion.button
              type="button"
              disabled={scheduling || draft.approved === false}
              whileTap={{ scale: 0.98 }}
              onClick={() => void onSchedule()}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scheduling ? "Scheduling…" : "Schedule to Buffer"}
            </motion.button>
            {scheduleMsg && <p className="text-xs text-zinc-400">{scheduleMsg}</p>}
            {draft.buffer != null ? (
              <BufferSummary buffer={draft.buffer as Record<string, unknown>} />
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}
