"use client";

import { motion } from "framer-motion";
import type { AppConfig } from "@/lib/api";

export function SetupBanner({ config }: { config: AppConfig | null }) {
  if (!config) return null;
  const issues: string[] = [];
  if (!config.bufferTokenSet) issues.push("Add BUFFER_ACCESS_TOKEN or BUFFER_API_KEY");
  if (!config.bufferChannelSet) issues.push("Add BUFFER_PROFILE_ID (Instagram channel id)");
  if (config.bufferApi !== "legacy" && config.imageHosting === "unset") {
    issues.push("Set PUBLIC_BASE_URL or IMGBB_API_KEY for slide images");
  }
  if (!issues.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
    >
      <p className="font-medium text-amber-50">Finish setup in `.env` then restart the API</p>
      <ul className="mt-2 list-inside list-disc text-amber-100/90">
        {issues.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </motion.div>
  );
}
