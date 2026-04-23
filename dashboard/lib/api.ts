export type AppConfig = {
  bufferTokenSet: boolean;
  bufferChannelSet: boolean;
  imageHosting: "unset" | "public_url" | "imgbb";
  bufferApi: string;
};

export type DraftListItem = {
  id: string;
  topic: string;
  createdAt: string;
  approved: boolean;
  scoreAverage: number | null;
  slideCount: number;
  thumbnailUrl: string | null;
  scheduledAt: string | null;
  bufferScheduled: boolean;
};

export type DraftDetail = {
  id: string;
  topic: string;
  scheduledAt: string;
  approved: boolean;
  scores: { average?: number };
  feedback: string[];
  content: Record<string, unknown>;
  imageUrls: string[];
  buffer?: Record<string, unknown> | null;
};

function errorMessageFromBody(text: string): string | null {
  try {
    const j = JSON.parse(text) as { error?: string; message?: string };
    if (j && typeof j === "object") {
      if (typeof j.error === "string" && j.error) return j.error;
      if (typeof j.message === "string" && j.message) return j.message;
    }
  } catch {
    // not JSON
  }
  return null;
}

/** Reads JSON; on !ok tries API error field, else a clear message for 404 (e.g. Vercel proxy not configured). */
async function readJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!r.ok) {
    if (text) {
      const fromApi = errorMessageFromBody(text);
      if (fromApi) throw new Error(fromApi);
    }
    if (r.status === 404) {
      throw new Error(
        "API returned 404. On Vercel: Settings → Environment Variables → add API_PROXY_TARGET = your Render API base URL (no path, no trailing slash), e.g. https://your-service.onrender.com — then create a new deployment."
      );
    }
    throw new Error(`Request failed (${r.status})`);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid response (${r.status})`);
  }
}

export async function fetchConfig(): Promise<AppConfig> {
  const r = await fetch("/api/config", { cache: "no-store" });
  return readJson<AppConfig>(r);
}

export async function fetchDrafts(): Promise<DraftListItem[]> {
  const r = await fetch("/api/drafts?limit=100", { cache: "no-store" });
  const data = await readJson<{ drafts?: DraftListItem[] }>(r);
  return data.drafts || [];
}

export async function fetchDraft(id: string): Promise<DraftDetail> {
  const r = await fetch(`/api/drafts/${encodeURIComponent(id)}`, { cache: "no-store" });
  const data = await readJson<{ draft?: DraftDetail }>(r);
  if (!data.draft) throw new Error("draft missing");
  return data.draft;
}

export async function generateTopic(topic: string): Promise<DraftDetail> {
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic })
  });
  return readJson<DraftDetail>(r);
}

export async function scheduleDraft(draftId: string, scheduledAt: string): Promise<{ post: DraftDetail }> {
  const r = await fetch("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftId, scheduledAt })
  });
  const data = await readJson<{ post?: DraftDetail }>(r);
  if (!data.post) throw new Error("no post in response");
  return { post: data.post };
}
