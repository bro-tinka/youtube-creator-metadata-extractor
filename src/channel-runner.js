import { hasEmailGenerationLimitBeenReached, recordHasContact, recordHasEmail } from "./limits.js";

export async function processChannels({ channels, config, logger, sink, scrapeChannel, concurrency = 1, isStopRequested = () => false }) {
  let generatedEmailCount = 0;
  let processedChannelCount = 0;
  let scrapedChannelCount = 0;
  let entriesSavedThisSession = 0;
  let entriesAddedThisSession = 0;
  let nextChannelIndex = 0;
  let saveChain = Promise.resolve();

  const queueSave = (record) => {
    const saveOperation = saveChain.then(() => sink.upsertAndSave(record));
    saveChain = saveOperation.catch(() => {});
    return saveOperation;
  };

  async function worker(workerId) {
    while (!isStopRequested()) {
      if (hasEmailGenerationLimitBeenReached(generatedEmailCount, config.maxChannelEmailsToGenerate)) break;
      const index = nextChannelIndex;
      nextChannelIndex += 1;
      const channel = channels[index];
      if (!channel) break;

      try {
        const record = await scrapeChannel(channel, workerId);
        scrapedChannelCount += 1;

        if (!recordHasContact(record)) {
          logger.info("Skipped creator without email or Instagram", { name: record.name, channel: channel.url });
          continue;
        }

        if (recordHasEmail(record)) {
          if (hasEmailGenerationLimitBeenReached(generatedEmailCount, config.maxChannelEmailsToGenerate)) {
            logger.warn("Email limit reached; result will not be saved", { name: record.name, email: record.email });
            continue;
          }
          generatedEmailCount += 1;
          logger.info("Generated channel email", {
            count: generatedEmailCount,
            limit: config.maxChannelEmailsToGenerate ?? "unlimited",
            email: record.email,
            name: record.name,
          });
        }

        const saveResult = await queueSave(record);
        processedChannelCount += 1;
        entriesSavedThisSession += 1;
        if (saveResult?.created) entriesAddedThisSession += 1;
        logger.info("Completed channel", {
          position: index + 1,
          total: channels.length,
          worker: workerId + 1,
          name: record.name,
        });
      } catch (error) {
        logger.error("Channel failed; continuing", { position: index + 1, channel: channel.url, worker: workerId + 1, error: error.message });
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), channels.length || 1);
  await Promise.all(Array.from({ length: workerCount }, (_, workerId) => worker(workerId)));
  await saveChain;

  if (hasEmailGenerationLimitBeenReached(generatedEmailCount, config.maxChannelEmailsToGenerate)) {
    logger.info("Email generation limit reached", {
      generatedEmailCount,
      maxChannelEmailsToGenerate: config.maxChannelEmailsToGenerate,
    });
  }

  return {
    generatedEmailCount,
    processedChannelCount,
    scrapedChannelCount,
    workerCount,
    entriesSavedThisSession,
    entriesAddedThisSession,
  };
}
