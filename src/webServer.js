const path = require("path");
const express = require("express");
const { formatISO, addHours } = require("date-fns");
const { runPipeline } = require("./pipeline/runPipeline");
const { schedulePost, listProfiles } = require("./services/bufferClient");
const { getPostById, updatePostById, listPostsRecent } = require("./utils/storage");
const { OUTPUT_DIR } = require("./utils/paths");
const { toDraftResponse, toDraftListItem } = require("./utils/draftSerializer");

function startWebServer({ config, port = 3000 }) {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  api.get("/health", (_req, res) => {
    res.json({
      ok: true,
      routes: [
        "/api/health",
        "/api/config",
        "/api/drafts",
        "/api/drafts/:id",
        "/api/buffer/profiles",
        "/api/generate",
        "/api/schedule"
      ]
    });
  });

  api.get("/config", (_req, res) => {
    const tokenSet = Boolean((process.env.BUFFER_ACCESS_TOKEN || process.env.BUFFER_API_KEY || "").trim());
    const channelSet = Boolean((process.env.BUFFER_PROFILE_ID || process.env.BUFFER_PROFILE_IDS || "").trim());
    let imageHosting = "unset";
    if ((process.env.PUBLIC_BASE_URL || process.env.BUFFER_PUBLIC_BASE_URL || "").trim()) {
      imageHosting = "public_url";
    } else if ((process.env.IMGBB_API_KEY || "").trim()) {
      imageHosting = "imgbb";
    }
    res.json({
      bufferTokenSet: tokenSet,
      bufferChannelSet: channelSet,
      imageHosting,
      bufferApi: String(process.env.BUFFER_API || "graphql").toLowerCase()
    });
  });

  api.get("/drafts", (req, res) => {
    try {
      const limit = Number(req.query.limit) || 80;
      const posts = listPostsRecent(limit);
      const drafts = posts.map((p) => toDraftListItem(p));
      return res.json({ drafts });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  api.get("/drafts/:id", (req, res) => {
    try {
      const draft = getPostById(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found." });
      }
      return res.json({ draft: toDraftResponse(draft) });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  api.get("/buffer/profiles", async (_req, res) => {
    try {
      const profiles = await listProfiles();
      return res.json({ profiles });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  api.post("/generate", async (req, res) => {
    try {
      const topic = String(req.body?.topic || "").trim();
      if (!topic) {
        return res.status(400).json({ error: "Topic is required." });
      }

      const scheduledAt = req.body?.scheduledAt || formatISO(addHours(new Date(), 2));
      const result = await runPipeline({
        topic,
        scheduledAt,
        config,
        dryRun: true
      });

      return res.json(toDraftResponse(result));
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  api.post("/schedule", async (req, res) => {
    try {
      const draftId = String(req.body?.draftId || "").trim();
      const scheduledAt = req.body?.scheduledAt;
      if (!draftId) {
        return res.status(400).json({ error: "draftId is required." });
      }
      if (!scheduledAt) {
        return res.status(400).json({ error: "scheduledAt is required." });
      }

      const draft = getPostById(draftId);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found." });
      }
      if (draft.approved === false) {
        return res.status(400).json({ error: "Draft is not approved." });
      }

      const hashtags = Array.isArray(draft.content?.hashtags) ? draft.content.hashtags : [];
      const caption = `${draft.content?.caption || ""}\n\n${hashtags.join(" ")}`.trim();
      const buffer = await schedulePost({
        imagePaths: draft.imagePaths,
        caption,
        scheduledAt
      });

      const updated = updatePostById(draftId, (existing) => ({
        ...existing,
        scheduledAt,
        buffer
      }));

      return res.json({
        message: "Scheduled successfully",
        post: toDraftResponse(updated)
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.use("/api", api);

  app.use("/output", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/output", express.static(OUTPUT_DIR));

  const webRoot = path.join(__dirname, "..", "web");
  app.use("/", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/", express.static(webRoot));

  app.listen(port, () => {
    console.log(`API + static (legacy) at http://localhost:${port}`);
    console.log(
      "API: /api/health /api/config /api/drafts /api/drafts/:id /api/buffer/profiles POST /api/generate POST /api/schedule"
    );
    console.log("Frontend (Next.js): npm run dashboard:dev  →  http://localhost:3001");
  });
}

module.exports = { startWebServer, toDraftResponse };
