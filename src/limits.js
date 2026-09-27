export function parsePositiveInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function hasEmailGenerationLimitBeenReached(emailCount, limit) {
  return Number.isInteger(limit) && limit > 0 && emailCount >= limit;
}

export function recordHasEmail(record) {
  return typeof record?.email === "string" && record.email.trim().length > 0;
}

export function recordHasInstagram(record) {
  return typeof record?.instagram === "string" && record.instagram.trim().length > 0;
}

export function recordHasContact(record) {
  return recordHasEmail(record) || recordHasInstagram(record);
}
