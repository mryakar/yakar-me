const scalar = (raw) => {
  const v = raw.trim();
  if (v.startsWith('"')) return JSON.parse(v);
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
};

export function frontmatter(text) {
  const block = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!block) throw new Error('no frontmatter');
  const data = {};
  for (const line of block[1].split('\n')) {
    const m = /^([A-Za-z][\w-]*):\s*(\S.*)$/.exec(line);
    if (m) data[m[1]] = scalar(m[2]);
  }
  return data;
}
