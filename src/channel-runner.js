import { hasEmailGenerationLimitBeenReached, recordHasEmail } from "./limits.js";

export async function processChannels({ channels, config, logger, sink, scrapeChannel, isStopRequested = () => false }) {
  let generatedEmailCount = 0;
  let processedChannelCount = 0;

  for (const [index, channel] of channels.entries()) {
    if (isStopRequested() || hasEmailGenerationLimitBeenReached(generatedEmailCount, config.maxChannelEmailsToGenerate)) break;

    try {
      const record = await scrapeChannel(channel);
      await sink.upsertAndSave(record);
      processedChannelCount += 1;

      if (recordHasEmail(record)) {
        generatedEmailCount += 1;
        logger.info("Generated channel email", {
          count: generatedEmailCount,
          limit: config.maxChannelEmailsToGenerate ?? "unlimited",
          email: record.email,
          name: record.name,
        });
      }
      logger.info("Completed channel", { position: index + 1, total: channels.length, name: record.name });
    } catch (error) {
      logger.error("Channel failed; continuing", { position: index + 1, channel: channel.url, error: error.message });
    }
  }

  if (hasEmailGenerationLimitBeenReached(generatedEmailCount, config.maxChannelEmailsToGenerate)) {
    logger.info("Email generation limit reached", {
      generatedEmailCount,
      maxChannelEmailsToGenerate: config.maxChannelEmailsToGenerate,
    });
  }

  return { generatedEmailCount, processedChannelCount };
}
