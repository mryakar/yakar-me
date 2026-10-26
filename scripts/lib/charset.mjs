export const BASELINE =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  ' ¡¿«»©®°±²³·×÷' +
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝßàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ' +
  'ĀāĂăĄąĆćČčĎďĐđĒēĖėĘęĚěĞğĠġĪīİıĶķĹĺĽľŁłŃńŅņŇňŌōŐőŒœŔŕŘřŚśŞşŠšŢţŤťŪūŮůŰűŲųŸŹźŻżŽžȘșȚț' +
  '­‐‑‒–—‘’‚“”„†‡•…‰′″‹›' +
  '⁄€ℓ™←↑→↓↗−∕≈≠≤≥⌘♭♯ﬁﬂ';

export const charsOf = (text) => new Set([...text]);

export function ranges(chars) {
  const points = [...new Set([...chars].map((c) => c.codePointAt(0)))].sort((a, b) => a - b);
  const out = [];
  for (const p of points) {
    const last = out.at(-1);
    if (last && p === last[1] + 1) last[1] = p;
    else out.push([p, p]);
  }
  const hex = (p) => p.toString(16).toUpperCase().padStart(4, '0');
  return out.map(([a, b]) => (a === b ? `U+${hex(a)}` : `U+${hex(a)}-${hex(b)}`));
}

export function expand(rangeList) {
  const set = new Set();
  for (const r of rangeList) {
    const m = /^U\+([0-9A-F]{4,6})(?:-([0-9A-F]{4,6}))?$/i.exec(r);
    if (!m) throw new Error(`bad range ${r}`);
    const a = parseInt(m[1], 16);
    const b = m[2] ? parseInt(m[2], 16) : a;
    for (let p = a; p <= b; p++) set.add(String.fromCodePoint(p));
  }
  return set;
}

export const missingChars = (text, charset) => [...charsOf(text)].filter((c) => !charset.has(c) && !/\s/.test(c));

export const describe = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} ${JSON.stringify(c)}`;
