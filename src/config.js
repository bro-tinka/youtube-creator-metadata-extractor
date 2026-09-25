import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ override: true });

function integerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function booleanEnv(name, fallback) {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

const liveGamingChannelLink = process.env.LIVE_GAMING_CHANNEL_LINK?.trim();
const outputXlsxPath = process.env.OUTPUT_XLSX_PATH?.trim();

if (!liveGamingChannelLink) {
  throw new Error("LIVE_GAMING_CHANNEL_LINK is required in .env");
}
if (!outputXlsxPath) {
  throw new Error("OUTPUT_XLSX_PATH is required in .env");
}

export const config = Object.freeze({
  liveGamingChannelLink,
  outputXlsxPath: path.resolve(outputXlsxPath),
  headless: booleanEnv("HEADLESS", true),
  navigationTimeoutMs: integerEnv("NAVIGATION_TIMEOUT_MS", 30_000),
  descriptionTimeoutMs: integerEnv("DESCRIPTION_TIMEOUT_MS", 6_000),
  maxRetries: integerEnv("MAX_RETRIES", 2),
  logLevel: process.env.LOG_LEVEL?.trim().toLowerCase() || "info",
});
