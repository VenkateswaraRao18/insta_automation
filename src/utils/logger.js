const fs = require("fs");
const { RUNS_LOG_PATH } = require("./paths");

function createLogger(context = "pipeline") {
  return {
    info(message, data = {}) {
      writeLog("INFO", context, message, data);
    },
    warn(message, data = {}) {
      writeLog("WARN", context, message, data);
    },
    error(message, data = {}) {
      writeLog("ERROR", context, message, data);
    }
  };
}

function writeLog(level, context, message, data) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...data
  };
  fs.appendFileSync(RUNS_LOG_PATH, `${JSON.stringify(payload)}\n`, "utf-8");
}

module.exports = { createLogger };
