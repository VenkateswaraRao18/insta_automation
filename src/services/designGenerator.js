const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");
const { getSlideHtml } = require("../templates/carouselTemplate");
const { DATA_DIR } = require("../utils/paths");

async function generateCarouselImages({ content, topic = "", outputDir, runId }) {
  const avatarUrl = getDefaultAvatarUrl();
  const handle = process.env.INSTAGRAM_HANDLE || "@venky";
  const sourceSlides = normalizeSlideInputs(content);
  const topicKey =
    String(topic || content.hookTitle || "") +
    (typeof sourceSlides[0] === "object" ? sourceSlides[0]?.headline || "" : String(sourceSlides[0] || ""));
  const variantOrder = rotateTemplateOrder(topicKey);

  const middleSlides = sourceSlides.map((slide, index) => {
    return {
      slideType: variantOrder[index % variantOrder.length],
      data: toMiddleSlideData(slide)
    };
  });

  const slides = [
    {
      slideType: "cover",
      data: toCoverData(content, content.caption)
    },
    ...middleSlides,
    {
      slideType: "cta",
      data: toCtaData(content, content.caption)
    }
  ].map((slide) => ({
    ...slide,
    data: {
      ...slide.data,
      avatarUrl,
      handle
    }
  }));

  const postDir = path.join(outputDir, runId);
  fs.mkdirSync(postDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1080 }
  });

  const imagePaths = [];
  try {
    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      const html = getSlideHtml({
        slideType: slide.slideType,
        data: slide.data,
        slideIndex: i + 1,
        totalSlides: slides.length
      });
      await page.setContent(html, { waitUntil: "load" });
      await page
        .waitForFunction(
          () => {
            const el = document.querySelector("img.avatar");
            if (!el || !el.getAttribute("src")) return true;
            return el.complete && el.naturalWidth > 0;
          },
          { timeout: 8000 }
        )
        .catch(() => {});
      const filePath = path.join(postDir, `slide-${i + 1}.png`);
      await page.screenshot({ path: filePath });
      imagePaths.push(filePath);
    }
  } finally {
    await browser.close();
  }

  return imagePaths;
}

function toCoverData(content, caption) {
  if (content.hookTitle && content.hookSubtitle) {
    return {
      tag: "ESSENTIAL GUIDE",
      title: enforceWordCap(content.hookTitle, 3),
      subtitle: String(content.hookSubtitle).trim()
    };
  }
  const hook = String(content.hook || "");
  const { title, detail } = splitTitleDetail(hook);
  const compact = shortenHeading(title, 3);
  return {
    tag: "ESSENTIAL GUIDE",
    title: compact.title,
    subtitle: compact.remainder || detail || pickSentence(caption)
  };
}

function normalizeSlideInputs(content) {
  const slides = content.slides || [];
  if (slides[0] && typeof slides[0] === "object" && slides[0].teach) {
    const copy = [...slides];
    while (copy.length < 4) copy.push(copy[copy.length - 1]);
    return copy.slice(0, 4);
  }
  const legacy = slides.map((s) => String(s));
  while (legacy.length < 4) {
    legacy.push(
      legacy[legacy.length - 1] ||
        (content.hook ? String(content.hook) : `${content.hookTitle}: ${content.hookSubtitle}`)
    );
  }
  return legacy.slice(0, 4);
}

function toMiddleSlideData(slide) {
  if (slide && typeof slide === "object" && slide.teach) {
    const [p1, p2, p3] = listBulletsFromStructured(slide);
    return {
      heading: String(slide.headline || "").trim(),
      intro: String(slide.teach || "").trim(),
      point1: p1,
      point2: p2,
      point3: p3,
      codeLine: String(slide.codeSnippet || "").trim(),
      bodyText: String(slide.example || "").trim(),
      quoteText: String(slide.takeaway || "").trim(),
      concept1Label: compactTitle(slide.headline),
      concept1Body: String(slide.teach || "").trim(),
      concept2Label: "Takeaway",
      concept2Body: String(slide.takeaway || "").trim()
    };
  }
  return toMiddleSlideDataLegacy(String(slide || ""));
}

function listBulletsFromStructured(s) {
  const parts = splitExampleFragments(s.example);
  if (parts.length >= 3) return [clampWords(parts[0], 16), clampWords(parts[1], 16), clampWords(parts[2], 16)];
  return makeDistinctThree(
    [clampWords(s.teach, 14), clampWords(s.example, 14), clampWords(s.takeaway, 14)],
    s.headline,
    `${s.teach} ${s.example}`
  );
}

function splitExampleFragments(example) {
  return String(example || "")
    .split(/\s*;\s*|\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function clampWords(text, maxWords) {
  const w = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return w.slice(0, maxWords).join(" ");
}

function toMiddleSlideDataLegacy(rawText) {
  const { title, detail } = splitTitleDetail(rawText);
  const body = (detail || rawText).trim();
  const normalized = splitIntoSentences(body);
  const clauseParts = normalized.length ? normalized : splitByClauses(body);
  const [p1, p2, p3] = buildThreeListPoints(body, title, clauseParts);
  return {
    heading: title,
    intro: clauseParts[0] || body,
    point1: p1,
    point2: p2,
    point3: p3,
    codeLine: toPseudoCode(title),
    bodyText: body,
    quoteText: body,
    concept1Label: compactTitle(title),
    concept1Body: p1,
    concept2Label: "Why it matters",
    concept2Body: p2
  };
}

function buildThreeListPoints(body, title, clauseParts) {
  const a = (clauseParts[0] || body).trim();
  const b = (clauseParts[1] || "").trim();
  const c = (clauseParts[2] || "").trim();
  if (a && b && c) return makeDistinctThree([a, b, c], title, body);
  const bySemi = body.split(/;\s+/).map((s) => s.trim()).filter(Boolean);
  if (bySemi.length >= 3) return makeDistinctThree(bySemi.slice(0, 3), title, body);
  const byComma = body.split(/,\s+/).map((s) => s.trim()).filter((s) => s.length > 4);
  if (byComma.length >= 3) return makeDistinctThree(byComma.slice(0, 3), title, body);
  const byAnd = body.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  if (byAnd.length >= 3) return makeDistinctThree(byAnd.slice(0, 3), title, body);
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length >= 9) {
    const n = Math.max(2, Math.ceil(words.length / 3));
    return makeDistinctThree(
      [
        words.slice(0, n).join(" "),
        words.slice(n, n * 2).join(" "),
        words.slice(n * 2).join(" ")
      ],
      title,
      body
    );
  }
  return makeDistinctThree(
    [a || body, compactTitle(title) + " — " + (b || a || body).trim(), c || a || body],
    title,
    body
  );
}

function makeDistinctThree(pts, title, body) {
  let a = String(pts[0] || "").trim();
  let b = String(pts[1] || "").trim();
  let c = String(pts[2] || "").trim();
  if (a && (a === b || a === c || b === c)) {
    const w = body.split(/\s+/).filter(Boolean);
    if (w.length >= 6) {
      const n = Math.max(2, Math.ceil(w.length / 3));
      a = w.slice(0, n).join(" ");
      b = w.slice(n, 2 * n).join(" ");
      c = w.slice(2 * n).join(" ");
    }
  }
  if (!a) a = title || body.slice(0, 40);
  if (!b) b = body.slice(40, 100) || a;
  if (!c) c = body.slice(100) || b;
  return [a, b, c].map((s) => String(s).trim());
}

function toCtaData(content, caption) {
  if (content.ctaTitle && content.ctaSubtitle) {
    return {
      title: enforceWordCap(content.ctaTitle, 3),
      subtitle: String(content.ctaSubtitle).trim(),
      ctaAction: process.env.CTA_ACTION_LINE || "Follow for more"
    };
  }
  const cta = String(content.cta || "").replace(/^call to action[:\-]?\s*/i, "").trim();
  const compact = shortenHeading(cta || "Your turn", 3);
  return {
    title: compact.title,
    subtitle: compact.remainder || pickSentence(caption) || "Save this and try one idea today.",
    ctaAction: process.env.CTA_ACTION_LINE || "Follow for more"
  };
}

function splitTitleDetail(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return { title: "Untitled", detail: "" };
  }
  if (text.includes(":")) {
    const [left, ...rest] = text.split(":");
    const title = left.trim() || "Untitled";
    const detail = rest.join(":").trim();
    return { title, detail: detail || text };
  }
  const words = text.split(/\s+/).filter(Boolean);
  const title = words.slice(0, Math.min(5, words.length)).join(" ");
  return { title, detail: text };
}

function splitIntoSentences(text) {
  return String(text || "")
    .split(/[.!?]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitByClauses(text) {
  return String(text || "")
    .split(/[,;]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function pickSentence(text) {
  return splitIntoSentences(text)[0] || "";
}

function compactTitle(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(" ") || "Concept";
}

function toPseudoCode(title) {
  const key = compactTitle(title).replace(/\s+/g, "_").toLowerCase();
  return `const ${key || "insight"} = applyNow();`;
}

function enforceWordCap(text, maxWords) {
  const w = String(text || "")
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return w.slice(0, maxWords).join(" ") || "Untitled";
}

function shortenHeading(text, maxWords = 3) {
  const words = String(text || "")
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) {
    return { title: "Untitled", remainder: "" };
  }
  const title = words.slice(0, maxWords).join(" ");
  const remainder = words.slice(maxWords).join(" ");
  return { title, remainder };
}

function getDefaultAvatarUrl() {
  const envPath = process.env.PROFILE_IMAGE_PATH
    ? path.resolve(process.env.PROFILE_IMAGE_PATH)
    : null;
  const candidates = [
    envPath,
    path.join(DATA_DIR, "profile.jpg"),
    path.join(DATA_DIR, "profile.jpeg"),
    path.join(DATA_DIR, "profile.png"),
    path.join(DATA_DIR, "profile.webp")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      if (String(process.env.AVATAR_USE_FILE_URL || "").toLowerCase() === "true") {
        return pathToFileURL(candidate).href;
      }
      const ext = path.extname(candidate).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      const bytes = fs.readFileSync(candidate);
      return `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }
  return "";
}

function rotateTemplateOrder(key) {
  const base = ["list", "code", "quote", "concept"];
  const h = simpleHash(String(key));
  const rot = h % 4;
  return [...base.slice(rot), ...base.slice(0, rot)];
}

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

module.exports = { generateCarouselImages };
