"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { DraftListItem } from "@/lib/api";

export function DraftCard({ draft, index }: { draft: DraftListItem; index: number }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 380, damping: 28 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl backdrop-blur-sm transition hover:border-indigo-500/40 hover:shadow-glow"
    >
      <Link href={`/draft/${encodeURIComponent(draft.id)}`} className="block">
        <div className="aspect-square bg-zinc-800/80">
          {draft.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600">No preview</div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {draft.scoreAverage != null && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-200">
                {draft.scoreAverage.toFixed(1)} score
              </span>
            )}
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {draft.slideCount} slides
            </span>
            {draft.bufferScheduled && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                Buffer
              </span>
            )}
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">{draft.topic}</h3>
          <p className="text-xs text-zinc-500">
            {new Date(draft.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short"
            })}
          </p>
        </div>
      </Link>
    </motion.article>
  );
}
