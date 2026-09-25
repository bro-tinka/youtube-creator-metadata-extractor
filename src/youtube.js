import { chooseBusinessEmail, decodeRedirectUrl, normalizeYouTubeChannelUrl } from "./text.js";

async function gotoWithRetry(page, url, config, logger) {
  let lastError;
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
      return;
    } catch (error) {
      lastError = error;
      logger.warn("Navigation failed", { url, attempt, error: error.message });
      if (attempt <= config.maxRetries) await page.waitForTimeout(500 * attempt);
    }
  }
  throw lastError;
}


async function expandAndReadDescription(page, config, logger) {
  const timeout = config.descriptionTimeoutMs || 3000;
  let expanded = false;

  // 1. Primary Strategy: Locate by accessible button label
  try {
    const accessibleBtn = page.getByRole("button", { name: /^Description\./i }).first();
    if (await accessibleBtn.isVisible({ timeout: 1500 })) {
      await accessibleBtn.click({ timeout });
      expanded = true;
    }
  } catch (error) {
    logger.debug("Accessible Description button click failed", { error: error.message });
  }

  // 2. Fallback Strategy: Filter #description-inline-expander for "...more"
  if (!expanded) {
    try {
      const moreButton = page
        .locator("#description-inline-expander")
        .locator("button, tp-yt-paper-button")
        .filter({ hasText: "...more" })
        .first();

      if (await moreButton.isVisible({ timeout: 1500 })) {
        await moreButton.click({ timeout });
        expanded = true;
      }
    } catch (error) {
      logger.debug("Fallback filter '...more' button click failed", { error: error.message });
    }
  }

  if (!expanded) {
    logger.warn("Could not find or click the description expansion button.");
    return null;
  }

}

export async function discoverLiveChannels(page, config, logger) {
  await gotoWithRetry(page, config.liveGamingChannelLink, config, logger);
  const channelLinks = page.locator('a[href^="/@"]');
  await channelLinks.first().waitFor({ state: "attached", timeout: config.navigationTimeoutMs });
  const raw = await channelLinks.evaluateAll((elements) => elements.map((element) => ({
    name: (element.textContent ?? "").trim(),
    href: element.getAttribute("href") ?? "",
  })));

  const seen = new Set();
  return raw
    .map((entry) => ({ ...entry, url: normalizeYouTubeChannelUrl(entry.href) }))
    .filter((entry) => entry.url && !seen.has(entry.url) && seen.add(entry.url));
}

export async function scrapeChannel(page, channel, config, logger) {
  await gotoWithRetry(page, channel.url, config, logger);
  const visibleHeading = page.locator("h1:visible").first();
  await visibleHeading.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });

  const initialText = await page.locator("body").innerText();
  const name = (await visibleHeading.innerText()).replace(/,\s*Verified$/i, "").trim() || channel.name;
  await expandAndReadDescription(page, config, logger);
  await page.waitForTimeout(250);
  const expandedText = await page.locator("body").innerText();
  const links = await page.locator("a[href]").evaluateAll((elements) => elements.map((element) => ({
    text: (element.textContent ?? "").trim(),
    href: element.getAttribute("href") ?? "",
  })));

  const instagram = [...new Set(links
    .map((link) => decodeRedirectUrl(link.href))
    .filter((href) => /instagram\.com\//i.test(href)))][0] ?? "";

  return {
    name,
    email: chooseBusinessEmail(`${initialText}\n${expandedText}`),
    youtubeChannel: channel.url,
    instagram,
  };
}
