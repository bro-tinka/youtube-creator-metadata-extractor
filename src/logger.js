const priority = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(level = "info") {
  const threshold = priority[level] ?? priority.info;
  const write = (kind, message, details) => {
    if (priority[kind] < threshold) return;
    const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
    console[kind === "debug" ? "log" : kind](`[${new Date().toISOString()}] ${kind.toUpperCase()} ${message}${suffix}`);
  };
  return {
    debug: (message, details) => write("debug", message, details),
    info: (message, details) => write("info", message, details),
    warn: (message, details) => write("warn", message, details),
    error: (message, details) => write("error", message, details),
  };
}
