require("dotenv").config();
const fs = require("fs");
const { Command } = require("commander");
const { addHours, formatISO } = require("date-fns");
const { runPipeline } = require("./pipeline/runPipeline");
const { CONFIG_PATH } = require("./utils/paths");
const { startWebServer } = require("./webServer");

const program = new Command();
program.name("instagram-ai-automation");

program
  .command("run")
  .requiredOption("--topic <topic>", "Post topic, e.g. productivity")
  .option("--schedule <iso>", "ISO date-time. Default is +2 hours.")
  .option("--dry-run", "Skip Buffer scheduling", false)
  .action(async (options) => {
    const config = readConfig();
    const scheduledAt = options.schedule || formatISO(addHours(new Date(), 2));

    const result = await runPipeline({
      topic: options.topic,
      scheduledAt,
      config,
      dryRun: options.dryRun
    });

    printResult(result);
  });

program
  .command("batch")
  .requiredOption("--topics <topics>", "Comma-separated topics")
  .option("--count <count>", "Limit number of topics", "5")
  .option("--schedule <iso>", "ISO date-time for first post")
  .option("--dry-run", "Skip Buffer scheduling", false)
  .action(async (options) => {
    const config = readConfig();
    const topics = options.topics
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, Number(options.count));

    let base = options.schedule ? new Date(options.schedule) : addHours(new Date(), 2);
    for (const topic of topics) {
      const scheduledAt = formatISO(base);
      const result = await runPipeline({
        topic,
        scheduledAt,
        config,
        dryRun: options.dryRun
      });
      printResult(result);
      base = addHours(base, 24);
    }
  });

program
  .command("web")
  .option("--port <port>", "Web server port", "3000")
  .action((options) => {
    const config = readConfig();
    startWebServer({
      config,
      port: Number(options.port)
    });
  });

program.parseAsync(process.argv).catch((error) => {
  console.error("Pipeline failed:", error.message);
  process.exit(1);
});

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      niche: "general education",
      tone: "clear and practical",
      postingFrequency: "daily"
    };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function printResult(result) {
  console.log("\n=== Post Ready ===");
  console.log(`ID: ${result.id}`);
  console.log(`Topic: ${result.topic}`);
  console.log(`Scheduled: ${result.scheduledAt}`);
  console.log(`Average score: ${result.scores.average}`);
  console.log(`Slides generated: ${result.imagePaths.length}`);
  if (result.buffer?.updateIds?.length) {
    console.log(`Buffer update IDs: ${result.buffer.updateIds.join(", ")}`);
  } else if (result.buffer?.updateId) {
    console.log(`Buffer update ID: ${result.buffer.updateId}`);
  }
  if (result.buffer?.note) {
    console.log(`Buffer note: ${result.buffer.note}`);
  }
}
