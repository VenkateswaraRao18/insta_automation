const fs = require("fs");
const crypto = require("crypto");
const { formatISO } = require("date-fns");
const { createAIClient } = require("../services/openaiClient");
const { generateCarouselContent } = require("../agents/contentGenerator");
const { evaluatePost } = require("../agents/evaluationAgent");
const { generateCarouselImages } = require("../services/designGenerator");
const { schedulePost } = require("../services/bufferClient");
const { addPost, topicExists } = require("../utils/storage");
const { createLogger } = require("../utils/logger");
const { OUTPUT_DIR } = require("../utils/paths");

async function runPipeline({ topic, scheduledAt, config, maxAttempts = 3, dryRun = false }) {
  const logger = createLogger("pipeline");
  const client = createAIClient();

  if (topicExists(topic)) {
    throw new Error(`Topic "${topic}" already exists in database. Use another topic.`);
  }

  let attempt = 0;
  let feedback = "";
  let lastEvaluation = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const runId = `${sanitize(topic)}-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;
    logger.info("Starting generation attempt", { topic, attempt, runId });

    const content = await generateCarouselContent({
      client,
      topic,
      config,
      feedback,
      attempt
    });

    lastEvaluation = await evaluatePost({
      client,
      content,
      imagePaths: []
    });

    logger.info("Evaluation finished", {
      attempt,
      average: lastEvaluation.average,
      approved: lastEvaluation.approved
    });

    if (!lastEvaluation.approved) {
      feedback = lastEvaluation.feedback.join("; ");
      continue;
    }

    const imagePaths = await generateCarouselImages({
      content,
      topic,
      outputDir: OUTPUT_DIR,
      runId
    });

    const finalCaption = `${content.caption}\n\n${content.hashtags.join(" ")}`;
    let bufferResult = null;

    if (!dryRun) {
      bufferResult = await schedulePost({
        imagePaths,
        caption: finalCaption,
        scheduledAt
      });
      logger.info("Post scheduled in Buffer", {
        updateId: bufferResult.updateId,
        updateIds: bufferResult.updateIds,
        mode: bufferResult.mode
      });
    }

    const postRecord = {
      id: runId,
      topic,
      createdAt: formatISO(new Date()),
      scheduledAt,
      attempt,
      approved: true,
      scores: {
        clarity: lastEvaluation.clarity,
        engagement: lastEvaluation.engagement,
        educationalValue: lastEvaluation.educationalValue,
        readability: lastEvaluation.readability,
        average: lastEvaluation.average
      },
      feedback: lastEvaluation.feedback,
      content,
      imagePaths,
      buffer: bufferResult
    };

    addPost(postRecord);
    return postRecord;
  }

  const rejectedRecord = {
    id: `rejected-${Date.now()}`,
    topic,
    createdAt: formatISO(new Date()),
    scheduledAt,
    approved: false,
    attempts: maxAttempts,
    lastEvaluation
  };

  addPost(rejectedRecord);
  throw new Error(`Post rejected after ${maxAttempts} attempts. Last score: ${lastEvaluation?.average}`);
}

function sanitize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

module.exports = { runPipeline };
