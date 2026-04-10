const PRIVATE_IPV4_PATTERNS = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^192\.168\./];

export function sanitizeDomainInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function stripPort(hostname: string): string {
  return hostname.replace(/:\d+$/, "").trim().toLowerCase();
}

export function isValidCustomDomain(domain: string): boolean {
  if (!domain) return false;
  if (domain === "localhost") return false;
  if (domain.includes("..")) return false;
  if (PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(domain))) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}
