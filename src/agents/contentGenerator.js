const { z } = require("zod");

/** One carousel = hook + exactly 4 educational blocks (maps 1:1 to middle slides). */
const SlideBlockSchema = z.object({
  headline: z.string().min(2).max(120),
  teach: z.string().min(8).max(600),
  example: z.string().min(8).max(600),
  /** One line that looks like code / math / CLI — must be topic-specific, not a placeholder. */
  codeSnippet: z.string().min(4).max(250),
  /** Short punchy line for quote-style card; must rephrase, not copy teach or example. */
  takeaway: z.string().min(8).max(600)
});

const ContentSchema = z.object({
  hookTitle: z.string().min(2).max(80),
  hookSubtitle: z.string().min(8).max(200),
  slides: z.array(SlideBlockSchema).length(4),
  ctaTitle: z.string().min(2).max(60),
  ctaSubtitle: z.string().min(8).max(200),
  caption: z.string().min(20).max(1000),
  hashtags: z.array(z.string().min(2).max(60)).min(5).max(15)
});

async function generateCarouselContent({ client, topic, config, feedback, attempt }) {
  const providerHint = `
Gemini-specific: Be dense and specific. Use real names (models, metrics, libraries) when relevant.
Never reuse the same sentence in teach, example, takeaway, or codeSnippet within one slide object.
codeSnippet must look like real syntax for the topic (Python, LaTeX-ish, or CLI), not generic placeholders.
`;

  const prompt = `
You are a senior technical educator creating Instagram carousel JSON.
Topic: ${topic}
Niche: ${config.niche}
Tone: ${config.tone}
Attempt: ${attempt}
Previous feedback: ${feedback || "none"}
${providerHint}

Return strict JSON only.

Cover:
- hookTitle: EXACTLY 1–3 words (main headline on slide 1).
- hookSubtitle: max 20 words, complements hookTitle, no copy-paste of hookTitle.

Body — exactly 4 slide objects in "slides". Each slide is a DIFFERENT subtopic/step. Order should tell a story (e.g. idea → mechanism → pitfall → usage).

For EACH slide object, fill ALL five fields with UNIQUE text (no field may duplicate another in the same slide):
- headline: max 8 words, slide title (specific, not generic).
- teach: max 22 words, one clear explanation of this slide only.
- example: max 20 words, a concrete scenario (numbers, tool names, or dataset/task) — must NOT paraphrase teach.
- codeSnippet: max 18 words AND max 120 characters, ONE line only — topic-relevant pseudo-code, formula, or shell. Forbidden: applyNow(), foo(), bar(), lorem, TODO, "your code here".
- takeaway: max 18 words, memorable one-liner — rephrase insight in new words; do not copy teach or example.

Across the 4 slides: vary angles (definition, step, comparison, warning, tip). No two slides should open the same way.

Forbidden everywhere: meta-writing ("add an example", "keep it simple"), filler, vague hype without facts.

CTA:
- ctaTitle: 1–3 words.
- ctaSubtitle: max 18 words.

JSON shape:
{
  "hookTitle": "",
  "hookSubtitle": "",
  "slides": [
    { "headline": "", "teach": "", "example": "", "codeSnippet": "", "takeaway": "" },
    { "headline": "", "teach": "", "example": "", "codeSnippet": "", "takeaway": "" },
    { "headline": "", "teach": "", "example": "", "codeSnippet": "", "takeaway": "" },
    { "headline": "", "teach": "", "example": "", "codeSnippet": "", "takeaway": "" }
  ],
  "ctaTitle": "",
  "ctaSubtitle": "",
  "caption": "",
  "hashtags": ["#tag1"]
}
`;

  const raw = ContentSchema.parse(await client.generateJson(prompt));
  const parsed = {
    ...raw,
    hook: buildHookString(raw),
    cta: buildCtaString(raw)
  };
  validateContent(parsed);
  return parsed;
}

function buildHookString(p) {
  return `${p.hookTitle.replace(/\s+/g, " ")}: ${p.hookSubtitle.replace(/\s+/g, " ")}`;
}

function buildCtaString(p) {
  return `${p.ctaTitle.replace(/\s+/g, " ")}. ${p.ctaSubtitle.replace(/\s+/g, " ")}`;
}

function validateContent(content) {
  const hookTitleWords = countWords(content.hookTitle);
  if (hookTitleWords < 1 || hookTitleWords > 3) {
    throw new Error(`hookTitle must be 1-3 words, got ${hookTitleWords}: "${content.hookTitle}"`);
  }
  if (countWords(content.hookSubtitle) > 20) {
    throw new Error(`hookSubtitle exceeds 20 words: "${content.hookSubtitle}"`);
  }
  const ctaTitleWords = countWords(content.ctaTitle);
  if (ctaTitleWords < 1 || ctaTitleWords > 3) {
    throw new Error(`ctaTitle must be 1-3 words, got ${ctaTitleWords}: "${content.ctaTitle}"`);
  }
  if (countWords(content.ctaSubtitle) > 18) {
    throw new Error(`ctaSubtitle exceeds 18 words: "${content.ctaSubtitle}"`);
  }

  for (let i = 0; i < content.slides.length; i += 1) {
    const s = content.slides[i];
    if (countWords(s.headline) > 8) {
      throw new Error(`Slide ${i + 1} headline exceeds 8 words`);
    }
    if (countWords(s.teach) > 22) {
      throw new Error(`Slide ${i + 1} teach exceeds 22 words`);
    }
    if (countWords(s.example) > 20) {
      throw new Error(`Slide ${i + 1} example exceeds 20 words`);
    }
    if (countWords(s.takeaway) > 18) {
      throw new Error(`Slide ${i + 1} takeaway exceeds 18 words`);
    }
    const cs = String(s.codeSnippet).trim();
    if (cs.length > 120 || countWords(cs) > 18) {
      throw new Error(`Slide ${i + 1} codeSnippet too long`);
    }
  }
}

function countWords(s) {
  return String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

module.exports = { generateCarouselContent };
