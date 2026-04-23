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

async function parseJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(`Bad JSON (${r.status})`);
  }
}

export async function fetchConfig(): Promise<AppConfig> {
  const r = await fetch("/api/config", { cache: "no-store" });
  const data = await parseJson<AppConfig & { error?: string }>(r);
  if (!r.ok) throw new Error((data as { error?: string }).error || "config failed");
  return data;
}

export async function fetchDrafts(): Promise<DraftListItem[]> {
  const r = await fetch("/api/drafts?limit=100", { cache: "no-store" });
  const data = await parseJson<{ drafts?: DraftListItem[]; error?: string }>(r);
  if (!r.ok) throw new Error(data.error || "drafts failed");
  return data.drafts || [];
}

export async function fetchDraft(id: string): Promise<DraftDetail> {
  const r = await fetch(`/api/drafts/${encodeURIComponent(id)}`, { cache: "no-store" });
  const data = await parseJson<{ draft?: DraftDetail; error?: string }>(r);
  if (!r.ok) throw new Error(data.error || "draft not found");
  if (!data.draft) throw new Error("draft missing");
  return data.draft;
}

export async function generateTopic(topic: string): Promise<DraftDetail> {
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic })
  });
  const data = await parseJson<DraftDetail & { error?: string }>(r);
  if (!r.ok) throw new Error(data.error || "generate failed");
  return data as DraftDetail;
}

export async function scheduleDraft(draftId: string, scheduledAt: string): Promise<{ post: DraftDetail }> {
  const r = await fetch("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftId, scheduledAt })
  });
  const data = await parseJson<{ post?: DraftDetail; error?: string }>(r);
  if (!r.ok) throw new Error(data.error || "schedule failed");
  if (!data.post) throw new Error("no post in response");
  return { post: data.post };
}
