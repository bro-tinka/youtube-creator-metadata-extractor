import { chromium } from "playwright";
import { config } from "./config.js";
import { createLogger } from "./logger.js";
import { discoverLiveChannels, scrapeChannel } from "./youtube.js";
import { WorkbookSink } from "./workbook.js";

const logger = createLogger(config.logLevel);
let stopRequested = false;

process.once("SIGINT", () => {
  stopRequested = true;
  logger.warn("Stop requested; the current channel will finish, then the workbook will be flushed.");
});
process.once("SIGTERM", () => {
  stopRequested = true;
  logger.warn("Termination requested; the current channel will finish, then the workbook will be flushed.");
});
process.on("unhandledRejection", (error) => logger.error("Unhandled promise rejection", { error: String(error) }));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  process.exitCode = 1;
});

async function run() {
  const sink = await new WorkbookSink(config.outputXlsxPath, logger).open();
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(config.navigationTimeoutMs);

  page.on("pageerror", (error) => logger.warn("YouTube page error", { error: error.message }));
  page.on("requestfailed", (request) => logger.debug("Network request failed", { url: request.url(), error: request.failure()?.errorText }));
  page.on("dialog", async (dialog) => {
    logger.warn("Unexpected browser dialog dismissed", { type: dialog.type(), message: dialog.message() });
    await dialog.dismiss().catch(() => {});
  });

  try {
    const channels = await discoverLiveChannels(page, config, logger);
    logger.info("Discovered live channels", { count: channels.length });

    for (const [index, channel] of channels.entries()) {
      if (stopRequested) break;
      try {
        const record = await scrapeChannel(page, channel, config, logger);
        await sink.upsertAndSave(record);
        logger.info("Completed channel", { position: index + 1, total: channels.length, name: record.name });
      } catch (error) {
        logger.error("Channel failed; continuing", { position: index + 1, channel: channel.url, error: error.message });
      }
    }
  } finally {
    await sink.saveNow();
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    logger.info("Run finished", { stopped: stopRequested, output: config.outputXlsxPath });
  }
}

run().catch((error) => {
  logger.error("Run failed", { error: error.message, stack: error.stack });
  process.exitCode = 1;
});
