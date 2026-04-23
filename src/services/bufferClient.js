const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { OUTPUT_DIR } = require("../utils/paths");

const BUFFER_LEGACY_BASE = "https://api.bufferapp.com/1";
const BUFFER_GRAPHQL_URL = "https://api.buffer.com";

function getBufferApiMode() {
  const v = String(process.env.BUFFER_API || "graphql").toLowerCase();
  if (v === "legacy") return "legacy";
  return "graphql";
}

function getBufferToken() {
  const token = (process.env.BUFFER_ACCESS_TOKEN || process.env.BUFFER_API_KEY || "").trim();
  if (!token) {
    throw new Error("Missing BUFFER_ACCESS_TOKEN or BUFFER_API_KEY (Buffer Settings → API).");
  }
  return token;
}

function getBufferConfig() {
  const token = getBufferToken();
  const rawIds = process.env.BUFFER_PROFILE_ID || process.env.BUFFER_PROFILE_IDS || "";
  const profileIds = String(rawIds)
    .split(/[,;\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  if (!profileIds.length) {
    throw new Error(
      "Missing BUFFER_PROFILE_ID. For GraphQL (Settings → API key), this must be your Buffer channel id (see GET /api/buffer/profiles)."
    );
  }
  return { token, profileIds };
}

/** @returns {Promise<any>} */
async function graphqlRequest({ query, variables }) {
  const token = getBufferToken();
  const response = await axios.post(
    BUFFER_GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      validateStatus: () => true
    }
  );
  if (response.status >= 400) {
    throw new Error(`Buffer GraphQL HTTP ${response.status}: ${formatBufferPayload(response.data)}`);
  }
  const body = response.data;
  if (body.errors?.length) {
    throw new Error(`Buffer GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  return body.data;
}

async function graphqlResolveOrganizationId() {
  const explicit = process.env.BUFFER_ORGANIZATION_ID?.trim();
  if (explicit) return explicit;
  const data = await graphqlRequest({
    query: `query Orgs { account { organizations { id name } } }`
  });
  const orgs = data?.account?.organizations || [];
  if (!orgs.length) {
    throw new Error("Buffer GraphQL: no organizations on this account.");
  }
  return orgs[0].id;
}

async function graphqlListChannelsRaw() {
  const orgId = await graphqlResolveOrganizationId();
  const data = await graphqlRequest({
    query: `query Ch($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id
        name
        service
      }
    }`,
    variables: { organizationId: orgId }
  });
  return data?.channels || [];
}

function buildPublicSlideUrlsFromBase(publicBase, imagePaths) {
  const base = String(publicBase).replace(/\/+$/, "");
  const outRoot = path.resolve(OUTPUT_DIR);
  return imagePaths.map((abs) => {
    const resolved = path.resolve(abs);
    const rel = path.relative(outRoot, resolved).replace(/\\/g, "/");
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Slide file must live under output/: ${abs}`);
    }
    const encoded = rel
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `${base}/output/${encoded}`;
  });
}

async function uploadImageToImgbb(imagePath, apiKey) {
  const buf = fs.readFileSync(imagePath);
  const body = new URLSearchParams();
  body.append("key", apiKey);
  body.append("image", buf.toString("base64"));
  const response = await axios.post("https://api.imgbb.com/1/upload", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true,
    timeout: 120000
  });
  if (response.status >= 400) {
    throw new Error(`ImgBB HTTP ${response.status}: ${formatBufferPayload(response.data)}`);
  }
  const d = response.data;
  if (!d?.success) {
    throw new Error(`ImgBB upload failed: ${formatBufferPayload(d)}`);
  }
  const url = d.data?.image?.url || d.data?.url;
  if (!url) {
    throw new Error(`ImgBB: no image URL in response: ${formatBufferPayload(d)}`);
  }
  return url;
}

/**
 * Public URLs for Buffer GraphQL: either PUBLIC_BASE_URL + /output paths, or upload each slide to ImgBB.
 */
async function resolveGraphqlImageUrls(imagePaths) {
  const publicBase = String(process.env.PUBLIC_BASE_URL || process.env.BUFFER_PUBLIC_BASE_URL || "").trim();
  if (publicBase) {
    return { urls: buildPublicSlideUrlsFromBase(publicBase, imagePaths), hosting: "public_url" };
  }
  const imgbbKey = (process.env.IMGBB_API_KEY || "").trim();
  if (imgbbKey) {
    const urls = [];
    for (const p of imagePaths) {
      urls.push(await uploadImageToImgbb(p, imgbbKey));
    }
    return { urls, hosting: "imgbb" };
  }
  throw new Error(
    "Buffer needs public image URLs. Set PUBLIC_BASE_URL (HTTPS tunnel to this app, e.g. ngrok) or set IMGBB_API_KEY (free key: https://api.imgbb.com/) to host slides; restart npm run web after editing .env."
  );
}

const channelServiceCache = new Map();

function clearChannelServiceCache() {
  channelServiceCache.clear();
}

async function graphqlGetChannelService(channelId) {
  if (channelServiceCache.has(channelId)) {
    return channelServiceCache.get(channelId);
  }
  const data = await graphqlRequest({
    query: `query Chan($id: ChannelId!) {
      channel(input: { id: $id }) {
        id
        service
      }
    }`,
    variables: { id: channelId }
  });
  const service = data?.channel?.service || null;
  channelServiceCache.set(channelId, service);
  return service;
}

function buildInstagramMetadata(imageCount) {
  const explicit = (process.env.BUFFER_INSTAGRAM_POST_TYPE || "").trim().toLowerCase();
  const type =
    explicit ||
    (imageCount > 1 ? "carousel" : "post");
  const shouldShareToFeed = String(process.env.BUFFER_INSTAGRAM_SHARE_TO_FEED || "true").toLowerCase() !== "false";
  return { type, shouldShareToFeed };
}

async function graphqlCreateScheduledPost({ channelId, text, dueAtIso, imageUrls }) {
  const input = {
    text,
    channelId,
    schedulingType: "automatic",
    mode: "customScheduled",
    dueAt: dueAtIso
  };
  if (imageUrls?.length) {
    input.assets = { images: imageUrls.map((url) => ({ url })) };
  }
  const service = await graphqlGetChannelService(channelId);
  if (service === "instagram") {
    input.metadata = {
      instagram: buildInstagramMetadata(imageUrls?.length || 0)
    };
  }
  const data = await graphqlRequest({
    query: `
      mutation CreateScheduled($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess {
            post {
              id
              text
              dueAt
            }
          }
          ... on MutationError {
            message
          }
        }
      }
    `,
    variables: { input }
  });
  const result = data?.createPost;
  if (!result) {
    throw new Error(`Buffer createPost: empty result ${formatBufferPayload(data)}`);
  }
  if (result.message) {
    throw new Error(`Buffer createPost: ${result.message}`);
  }
  const id = result.post?.id;
  if (!id) {
    throw new Error(`Buffer createPost: unexpected ${formatBufferPayload(result)}`);
  }
  return { updateId: id, post: result.post };
}

async function listProfilesGraphql() {
  const channels = await graphqlListChannelsRaw();
  return channels.map((ch) => ({
    id: ch.id,
    service: ch.service,
    formatted_username: ch.name,
    service_username: ch.name
  }));
}

async function listProfilesLegacy() {
  const token = getBufferToken();
  const response = await axios.get(`${BUFFER_LEGACY_BASE}/profiles.json`, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true
  });
  if (response.status >= 400) {
    throw new Error(`Buffer profiles failed (${response.status}): ${formatBufferPayload(response.data)}`);
  }
  const data = response.data;
  return Array.isArray(data) ? data : [];
}

async function listProfiles() {
  if (getBufferApiMode() === "graphql") {
    return listProfilesGraphql();
  }
  return listProfilesLegacy();
}

async function uploadImageLegacy(imagePath) {
  const { token } = getBufferConfig();
  const form = new FormData();
  form.append("media", fs.createReadStream(imagePath));

  const response = await axios.post(`${BUFFER_LEGACY_BASE}/uploads.json`, form, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders()
    },
    validateStatus: () => true
  });

  if (response.status >= 400) {
    throw new Error(`Buffer upload failed (${response.status}): ${formatBufferPayload(response.data)}`);
  }

  const d = response.data || {};
  const url = d.url || d.media?.url || d.photo || d.picture;
  if (!url) {
    throw new Error(`Buffer upload returned no image URL: ${formatBufferPayload(d)}`);
  }
  return url;
}

function validateScheduledAt(scheduledAt) {
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) {
    throw new Error(`Invalid scheduledAt date: "${scheduledAt}"`);
  }
  const minLeadSec = Number(process.env.BUFFER_MIN_LEAD_SECONDS || 600);
  const earliest = Date.now() + minLeadSec * 1000;
  if (t < earliest) {
    throw new Error(
      `scheduledAt must be at least ${minLeadSec}s in the future (Buffer / Instagram). Got ${new Date(t).toISOString()}`
    );
  }
}

async function schedulePostLegacy({ imagePaths, caption, scheduledAt }) {
  const { token, profileIds } = getBufferConfig();

  const mediaUrls = [];
  for (const imagePath of imagePaths) {
    const mediaUrl = await uploadImageLegacy(imagePath);
    if (!mediaUrl) {
      throw new Error(`Failed to upload image: ${imagePath}`);
    }
    mediaUrls.push(mediaUrl);
  }

  const staggerMinutes = Number(process.env.BUFFER_STAGGER_MINUTES || 0);
  if (staggerMinutes > 0 && mediaUrls.length > 1) {
    return scheduleStaggeredCarouselLegacy({
      token,
      profileIds,
      mediaUrls,
      caption,
      scheduledAt,
      staggerMinutes
    });
  }

  const update = await createUpdateLegacy({
    token,
    profileIds,
    text: caption,
    photoUrl: mediaUrls[0],
    scheduledAt
  });

  return {
    updateId: update.updateId,
    mediaUrls,
    mode: "legacy_single_image",
    note:
      mediaUrls.length > 1
        ? `Only first of ${mediaUrls.length} images attached (Buffer REST v1 limit). Set BUFFER_STAGGER_MINUTES=3 to queue each slide as its own scheduled post.`
        : undefined
  };
}

async function scheduleStaggeredCarouselLegacy({ token, profileIds, mediaUrls, caption, scheduledAt, staggerMinutes }) {
  const baseMs = new Date(scheduledAt).getTime();
  const stepMs = staggerMinutes * 60 * 1000;
  const updateIds = [];
  const lines = String(caption).split("\n");
  const shortLead = lines[0] || caption;

  for (let i = 0; i < mediaUrls.length; i += 1) {
    const when = new Date(baseMs + i * stepMs).toISOString();
    const text =
      i === 0
        ? caption
        : `(${i + 1}/${mediaUrls.length}) ${shortLead.slice(0, 200)}${shortLead.length > 200 ? "…" : ""}`;
    const u = await createUpdateLegacy({
      token,
      profileIds,
      text,
      photoUrl: mediaUrls[i],
      scheduledAt: when
    });
    updateIds.push(u.updateId);
  }

  return {
    updateIds,
    updateId: updateIds[0],
    mediaUrls,
    mode: "legacy_staggered_carousel",
    staggerMinutes
  };
}

async function createUpdateLegacy({ token, profileIds, text, photoUrl, scheduledAt }) {
  const scheduledUnix = Math.floor(new Date(scheduledAt).getTime() / 1000);
  const useJson = String(process.env.BUFFER_CREATE_JSON || "").toLowerCase() === "true";

  if (useJson) {
    const payload = {
      text,
      profile_ids: profileIds,
      media: { photo: photoUrl },
      scheduled_at: scheduledUnix,
      now: false,
      shorten: false
    };
    const response = await axios.post(`${BUFFER_LEGACY_BASE}/updates/create.json`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      validateStatus: () => true
    });
    assertBufferLegacySuccess(response);
    return { updateId: response.data?.updates?.[0]?.id || null, response: response.data };
  }

  const body = new URLSearchParams();
  body.append("text", text);
  for (const id of profileIds) {
    body.append("profile_ids[]", id);
  }
  body.append("media[photo]", photoUrl);
  body.append("scheduled_at", String(scheduledUnix));
  body.append("now", "false");
  body.append("shorten", "false");

  const response = await axios.post(`${BUFFER_LEGACY_BASE}/updates/create.json`, body.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    validateStatus: () => true
  });
  assertBufferLegacySuccess(response);
  return { updateId: response.data?.updates?.[0]?.id || null, response: response.data };
}

function assertBufferLegacySuccess(response) {
  if (response.status >= 400) {
    throw new Error(`Buffer create update failed (${response.status}): ${formatBufferPayload(response.data)}`);
  }
  if (response.data && response.data.success === false) {
    throw new Error(`Buffer create update rejected: ${formatBufferPayload(response.data)}`);
  }
  if (!response.data?.updates?.length) {
    throw new Error(`Buffer returned no updates: ${formatBufferPayload(response.data)}`);
  }
}

function buildGraphqlScheduleNote({ hosting, imageCount }) {
  const parts = [];
  if (hosting === "imgbb") {
    parts.push("Slides were uploaded to ImgBB so Buffer could fetch them (no PUBLIC_BASE_URL needed).");
  }
  if (imageCount > 1) {
    parts.push("Multiple images in one post (Instagram carousel when the channel supports it).");
  }
  return parts.length ? parts.join(" ") : undefined;
}

async function schedulePostGraphql({ imagePaths, caption, scheduledAt }) {
  clearChannelServiceCache();
  const { profileIds } = getBufferConfig();
  const dueAtIso = new Date(scheduledAt).toISOString();
  const { urls: imageUrls, hosting } = await resolveGraphqlImageUrls(imagePaths);
  const staggerMinutes = Number(process.env.BUFFER_STAGGER_MINUTES || 0);

  if (staggerMinutes > 0 && imageUrls.length > 1) {
    const baseMs = new Date(scheduledAt).getTime();
    const stepMs = staggerMinutes * 60 * 1000;
    const lines = String(caption).split("\n");
    const shortLead = lines[0] || caption;
    const updateIds = [];

    for (let i = 0; i < imageUrls.length; i += 1) {
      const when = new Date(baseMs + i * stepMs).toISOString();
      const text =
        i === 0
          ? caption
          : `(${i + 1}/${imageUrls.length}) ${shortLead.slice(0, 200)}${shortLead.length > 200 ? "…" : ""}`;
      for (const channelId of profileIds) {
        const r = await graphqlCreateScheduledPost({
          channelId,
          text,
          dueAtIso: when,
          imageUrls: [imageUrls[i]]
        });
        updateIds.push(r.updateId);
      }
    }

    return {
      updateIds,
      updateId: updateIds[0],
      mediaUrls: imageUrls,
      mode: "graphql_staggered_carousel",
      staggerMinutes,
      note: buildGraphqlScheduleNote({ hosting, imageCount: imageUrls.length })
    };
  }

  const updateIds = [];
  for (const channelId of profileIds) {
    const r = await graphqlCreateScheduledPost({
      channelId,
      text: caption,
      dueAtIso,
      imageUrls
    });
    updateIds.push(r.updateId);
  }

  return {
    updateId: updateIds[0],
    updateIds: profileIds.length > 1 ? updateIds : undefined,
    mediaUrls: imageUrls,
    mode: "graphql_scheduled",
    note: buildGraphqlScheduleNote({ hosting, imageCount: imageUrls.length })
  };
}

/**
 * Schedule to Buffer. Uses GraphQL (api.buffer.com) by default for keys from Buffer Settings → API.
 * Set BUFFER_API=legacy for classic api.bufferapp.com OAuth tokens.
 */
async function schedulePost({ imagePaths, caption, scheduledAt }) {
  validateScheduledAt(scheduledAt);
  if (getBufferApiMode() === "graphql") {
    return schedulePostGraphql({ imagePaths, caption, scheduledAt });
  }
  return schedulePostLegacy({ imagePaths, caption, scheduledAt });
}

async function uploadImage(imagePath) {
  if (getBufferApiMode() === "graphql") {
    throw new Error(
      "uploadImage is only for BUFFER_API=legacy. GraphQL uses PUBLIC_BASE_URL or IMGBB_API_KEY (see .env.example)."
    );
  }
  return uploadImageLegacy(imagePath);
}

function formatBufferPayload(data) {
  if (!data) return "(empty body)";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

module.exports = { schedulePost, listProfiles, uploadImage };
