const EMAIL_RE = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;
const BUSINESS_CONTEXT_RE = /(business|commercial|collab|collaboration|contact|query|queries|sponsor|sponsorship|work|booking|email)/i;

function cleanEmail(value) {
  return value
    .replace(/^[\s\-–—:;,|([{<]+/u, "")
    .replace(/[\s\-–—:;,|)\]}>.!?]+$/u, "");
}

export function extractEmails(text) {
  return [...new Set((text.match(EMAIL_RE) ?? []).map(cleanEmail).filter(Boolean))];
}

export function chooseBusinessEmail(text) {
  const emails = extractEmails(text);
  if (emails.length <= 1) return emails[0] ?? "";

  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!BUSINESS_CONTEXT_RE.test(line)) continue;
    const nearby = lines.slice(index, index + 3).join(" ");
    const match = extractEmails(nearby)[0];
    if (match) return match;
  }
  return emails[0];
}

export function decodeRedirectUrl(href) {
  try {
    const url = new URL(href, "https://www.youtube.com");
    const destination = url.searchParams.get("q");
    return destination ? decodeURIComponent(destination) : url.href;
  } catch {
    return href;
  }
}

export function normalizeYouTubeChannelUrl(href) {
  try {
    const url = new URL(href, "https://www.youtube.com");
    if (!/youtube\.com$/i.test(url.hostname) && !/youtube\.com$/i.test(url.hostname.replace(/^www\./i, ""))) {
      return "";
    }
    const pathname = url.pathname.replace(/\/$/, "");
    return `https://www.youtube.com${pathname}`;
  } catch {
    return "";
  }
}

export function normalizeKey(value) {
  return String(value ?? "").trim().replace(/\/$/, "").toLowerCase();
}
