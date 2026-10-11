const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function pngChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  const chunks = [];
  for (let i = 8; i < buf.length; ) {
    if (i + 12 > buf.length) throw new Error('truncated PNG chunk');
    const length = buf.readUInt32BE(i);
    chunks.push(buf.toString('latin1', i + 4, i + 8));
    i += 12 + length;
  }
  return chunks;
}
