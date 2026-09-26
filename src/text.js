const EMAIL_RE = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;
// Matches emails ending in .com or .in (case-insensitive)
const ALLOWED_TLD_RE = /\.(com|in)$/i;


function cleanEmail(value) {
  return value
    .replace(/^[\s\-–—:;,|([{<]+/u, "")
    .replace(/[\s\-–—:;,|)\]}>.!?]+$/u, "");
}

export function chooseBusinessEmail(text) {
  const emails = extractEmails(text);
  if (emails.length > 0) {
    return emails[0];
  }
  return "";
}

export function extractEmails(text) {
  const rawEmails = [...new Set((text.match(EMAIL_RE) ?? []).map(cleanEmail).filter(Boolean))];

  return rawEmails.filter((email) => ALLOWED_TLD_RE.test(email));
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
