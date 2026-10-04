export const isExternal = (url) => /^(https?:)?\/\//i.test(url) || /^data:/i.test(url);

export function inlineCodeProblems(html) {
  const problems = [];
  for (const [tag, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc=/i.test(attrs)) continue;
    if (!/^\s*type="application\/ld\+json"\s*$/i.test(attrs)) {
      problems.push(`inline script: ${tag.slice(0, 80)}`);
      continue;
    }
    if (/[<>]/.test(body)) problems.push('JSON-LD contains an unescaped < or >');
    try {
      JSON.parse(body);
    } catch {
      problems.push('JSON-LD is not valid JSON');
    }
  }
  if (/<style\b/i.test(html)) problems.push('inline <style>');
  if (/<[^>]+\sstyle=/i.test(html)) problems.push('style="" attribute');
  return problems;
}

export const loadedUrls = (html) =>
  [
    ...html.matchAll(/<(?:script|img|source|iframe|audio|video|embed)\b[^>]*\ssrc="([^"]*)"/gi),
    ...[...html.matchAll(/<link\b([^>]*)>/gi)]
      .filter(([, attrs]) => /\srel="(stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)"/i.test(attrs))
      .map(([, attrs]) => /\shref="([^"]*)"/i.exec(attrs) ?? [, '']),
  ]
    .map((m) => m[1])
    .concat([...html.matchAll(/\ssrcset="([^"]*)"/gi)].flatMap((m) => m[1].split(',').map((c) => c.trim().split(/\s+/)[0])));
