const OpenAI = require("openai");
const { GoogleGenAI } = require("@google/genai");
const { jsonrepair } = require("jsonrepair");

function createAIClient() {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  if (provider === "gemini") {
    return createGeminiClient();
  }
  if (provider === "openai") {
    return createOpenAIClient();
  }
  throw new Error(`Unsupported AI_PROVIDER "${provider}". Use "openai" or "gemini".`);
}

function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  return {
    provider: "openai",
    async generateJson(prompt) {
      const response = await client.responses.create({
        model,
        input: prompt
      });
      const text = extractOpenAIText(response);
      return parseModelJson(text);
    }
  };
}

function createGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment.");
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  return {
    provider: "gemini",
    async generateJson(prompt) {
      const retries = Number(process.env.GEMINI_MAX_RETRIES || 4);
      const backoffMs = Number(process.env.GEMINI_RETRY_BASE_MS || 1500);

      try {
        const response = await withRetry(
          () =>
            client.models.generateContent({
              model,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.55)
              }
            }),
          {
            retries,
            backoffMs,
            isRetryable: isGeminiRetryableError
          }
        );

        const text = response.text || "";
        return parseModelJson(text);
      } catch (error) {
        const allowFallback = String(process.env.AI_FALLBACK_TO_OPENAI || "true").toLowerCase() === "true";
        if (allowFallback && process.env.OPENAI_API_KEY) {
          const fallback = createOpenAIClient();
          return fallback.generateJson(prompt);
        }
        throw error;
      }
    }
  };
}

function extractOpenAIText(response) {
  if (response.output_text) return response.output_text;
  const out = response.output || [];
  const text = out
    .flatMap((item) => item.content || [])
    .find((content) => content.type === "output_text");
  if (!text) throw new Error("OpenAI response did not include text output.");
  return text.text;
}

function stripCodeFence(value) {
  return String(value)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * LLMs often emit almost-JSON: trailing commas, smart quotes, extra prose, or unescaped newlines.
 * jsonrepair fixes most cases; we still extract a single top-level object when possible.
 */
function parseModelJson(raw) {
  let text = stripCodeFence(raw);
  text = extractFirstJsonObject(text);
  text = normalizeJsonQuotes(text);
  try {
    return JSON.parse(text);
  } catch (firstErr) {
    try {
      return JSON.parse(jsonrepair(text));
    } catch (secondErr) {
      const pos = Number(String(firstErr.message).match(/position (\d+)/)?.[1]) || 0;
      const snippet = text.slice(Math.max(0, pos - 40), pos + 40);
      throw new Error(
        `Model returned invalid JSON (${firstErr.message}). Near: …${snippet}…`
      );
    }
  }
}

function extractFirstJsonObject(s) {
  const t = String(s).trim();
  const start = t.indexOf("{");
  if (start === -1) return t;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let q = "";
  for (let i = start; i < t.length; i += 1) {
    const ch = t[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === q) {
        inStr = false;
        q = "";
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      q = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }
  return t;
}

function normalizeJsonQuotes(s) {
  return s
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

function isGeminiRetryableError(error) {
  const text = String(error?.message || "").toLowerCase();
  return (
    text.includes('"status":"unavailable"') ||
    text.includes('"code":503') ||
    text.includes("high demand") ||
    text.includes("temporarily unavailable") ||
    text.includes("deadline exceeded") ||
    text.includes("timeout") ||
    text.includes('"code":429') ||
    text.includes("resource exhausted")
  );
}

async function withRetry(fn, { retries, backoffMs, isRetryable }) {
  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) {
        throw lastError;
      }
      const delay = backoffMs * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { createAIClient };
