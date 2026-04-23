const { z } = require("zod");

const EvaluationSchema = z.object({
  clarity: z.number().min(1).max(10),
  engagement: z.number().min(1).max(10),
  educationalValue: z.number().min(1).max(10),
  readability: z.number().min(1).max(10),
  feedback: z.array(z.string()).min(1)
});

async function evaluatePost({ client, content, imagePaths }) {
  const imageSummary = imagePaths?.length ? imagePaths.join("\n") : "Not generated yet";
  const prompt = `
Evaluate this Instagram educational carousel.
Return strict JSON only.

Content:
${JSON.stringify(content, null, 2)}

Image files generated:
${imageSummary}

Score each criterion 1-10:
- clarity
- engagement
- educationalValue
- readability

Hard rejection rules:
- Reject if content includes meta writing suggestions instead of real educational content.
- Reject phrases like:
  "use this in your next post"
  "add one concrete example"
  "keep it practical and easy to apply"
  "show how this works"
- Reject if slides are generic placeholders without topic-specific examples.

JSON format:
{
  "clarity": 8,
  "engagement": 8,
  "educationalValue": 8,
  "readability": 8,
  "feedback": ["item1", "item2"]
}
`;

  const parsed = EvaluationSchema.parse(await client.generateJson(prompt));
  const qualityCheck = detectTemplateOrMetaContent(content);
  const structureCheck = detectStructuredSlideQuality(content);
  const forceReject = qualityCheck.hasProblem || structureCheck.hasProblem;
  const average =
    (parsed.clarity + parsed.engagement + parsed.educationalValue + parsed.readability) / 4;
  const approved = average >= 7 && !forceReject;
  const feedback = forceReject
    ? [...parsed.feedback, ...qualityCheck.issues, ...structureCheck.issues]
    : parsed.feedback;

  return {
    ...parsed,
    feedback,
    average: Number(average.toFixed(2)),
    approved
  };
}

function flattenSlidesForScan(slides) {
  if (!slides?.length) return "";
  if (typeof slides[0] === "object" && slides[0]?.teach) {
    return slides
      .map((s) => [s.headline, s.teach, s.example, s.codeSnippet, s.takeaway].filter(Boolean).join(" "))
      .join(" ");
  }
  return slides.join(" ");
}

function detectStructuredSlideQuality(content) {
  const slides = content?.slides;
  if (!slides?.length || typeof slides[0] !== "object" || !slides[0]?.teach) {
    return { hasProblem: false, issues: [] };
  }
  const issues = [];
  const placeholderRe =
    /applynow|apply_now|foo\s*\(|bar\s*\(|lorem|todo:|your code here|const\s+insight\b|=\s*applyNow/i;

  for (let i = 0; i < slides.length; i += 1) {
    const s = slides[i];
    const cs = String(s.codeSnippet || "");
    if (placeholderRe.test(cs)) {
      issues.push(`Slide ${i + 1} codeSnippet looks generic or placeholder.`);
    }
    if (tooSimilar(s.teach, s.example) || tooSimilar(s.teach, s.takeaway) || tooSimilar(s.example, s.takeaway)) {
      issues.push(`Slide ${i + 1}: teach / example / takeaway are too similar (need distinct lines).`);
    }
  }

  const teaches = slides.map((s) => normalize(s.teach));
  for (let i = 0; i < teaches.length; i += 1) {
    for (let j = i + 1; j < teaches.length; j += 1) {
      if (teaches[i] && teaches[i] === teaches[j]) {
        issues.push(`Slides ${i + 1} and ${j + 1} duplicate the same teach text.`);
      }
    }
  }

  return issues.length ? { hasProblem: true, issues } : { hasProblem: false, issues: [] };
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tooSimilar(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = na.split(" ").filter((w) => w.length > 2);
  const wb = nb.split(" ").filter((w) => w.length > 2);
  if (!wa.length || !wb.length) return false;
  const setB = new Set(wb);
  const inter = wa.filter((w) => setB.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 && inter / union >= 0.62;
}

function detectTemplateOrMetaContent(content) {
  const text = [
    content?.hook || "",
    content?.hookTitle || "",
    content?.hookSubtitle || "",
    content?.ctaTitle || "",
    content?.ctaSubtitle || "",
    flattenSlidesForScan(content?.slides || []),
    content?.cta || "",
    content?.caption || ""
  ].join(" ");

  const lower = text.toLowerCase();

  const bannedSnippets = [
    "use this in your next post",
    "add one concrete example",
    "add a concrete example",
    "keep it practical and easy to apply",
    "show how this works"
  ];

  const regexHits = [
    /\badd\s+(one|a)\s+concrete\s+example\b/i,
    /\bpractical\s+and\s+easy\s+to\s+apply\b/i,
    /\bkeep\s+it\s+practical\s+and\s+easy\b/i
  ].filter((re) => re.test(text));

  const hits = bannedSnippets.filter((snippet) => lower.includes(snippet));
  if (!hits.length && !regexHits.length) {
    return { hasProblem: false, issues: [] };
  }

  return {
    hasProblem: true,
    issues: [
      `Rejected: meta or filler instructional lines found (${[...hits, ...regexHits.map((r) => r.source)].join("; ")}).`
    ]
  };
}

module.exports = { evaluatePost };
