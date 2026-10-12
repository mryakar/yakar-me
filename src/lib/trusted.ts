export function trustedScriptUrl(url: string, origin: string, path: string) {
  const parsed = new URL(url, origin);
  if (parsed.origin !== origin || parsed.pathname !== path || parsed.search || parsed.hash) {
    throw new TypeError(`script URL not allowed: ${url}`);
  }
  return parsed.href;
}
