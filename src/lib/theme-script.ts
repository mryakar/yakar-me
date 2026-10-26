export const THEME_SCRIPT_DIR = '/_astro/';

export async function themeScriptPath(source: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const hash = [...new Uint8Array(digest).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${THEME_SCRIPT_DIR}theme.${hash}.js`;
}
