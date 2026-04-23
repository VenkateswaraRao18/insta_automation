const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

module.exports = {
  ROOT,
  DATA_DIR: path.join(ROOT, "data"),
  OUTPUT_DIR: path.join(ROOT, "output"),
  LOGS_DIR: path.join(ROOT, "logs"),
  POSTS_DB_PATH: path.join(ROOT, "data", "posts.json"),
  RUNS_LOG_PATH: path.join(ROOT, "logs", "pipeline.log"),
  CONFIG_PATH: path.join(ROOT, "config.json")
};
