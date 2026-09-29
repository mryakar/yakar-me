export const ARTIST = 'Ahmet Yakar';
export const MAX_SIDE = 2560;
export const copyrightText = (year) => `Copyright ${year} ${ARTIST}. All rights reserved.`;
const COPYRIGHT = /^Copyright (\d{4}) Ahmet Yakar\. All rights reserved\.$/;

const IFD0_TAGS = new Map([
  [0x0112, 'Orientation'],
  [0x011a, 'XResolution'],
  [0x011b, 'YResolution'],
  [0x0128, 'ResolutionUnit'],
  [0x013b, 'Artist'],
  [0x0213, 'YCbCrPositioning'],
  [0x8298, 'Copyright'],
  [0x8769, 'ExifIFD'],
]);
const EXIF_TAGS = new Map([
  [0x9000, 'ExifVersion'],
  [0x9101, 'ComponentsConfiguration'],
  [0xa000, 'FlashpixVersion'],
  [0xa001, 'ColorSpace'],
  [0xa002, 'PixelXDimension'],
  [0xa003, 'PixelYDimension'],
]);
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

class Problems extends Error {}

function readTiff(buf) {
  if (buf.subarray(0, 6).toString('latin1') === 'Exif\0\0') buf = buf.subarray(6);
  const order = buf.subarray(0, 2).toString('latin1');
  if (order !== 'II' && order !== 'MM') throw new Problems('EXIF: bad byte order');
  const le = order === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  if (u16(2) !== 42) throw new Problems('EXIF: bad TIFF header');

  const readIfd = (offset, allowed, where) => {
    if (offset + 2 > buf.length) throw new Problems(`EXIF ${where}: truncated`);
    const count = u16(offset);
    const tags = {};
    for (let i = 0; i < count; i++) {
      const e = offset + 2 + i * 12;
      if (e + 12 > buf.length) throw new Problems(`EXIF ${where}: truncated`);
      const tag = u16(e);
      const type = u16(e + 2);
      const n = u32(e + 4);
      const name = allowed.get(tag);
      if (!name) throw new Problems(`EXIF ${where}: tag 0x${tag.toString(16).padStart(4, '0')} not allowed`);
      const size = (TYPE_SIZE[type] ?? 0) * n;
      if (!size) throw new Problems(`EXIF ${where}: ${name} has bad type`);
      const at = size <= 4 ? e + 8 : u32(e + 8);
      if (at + size > buf.length) throw new Problems(`EXIF ${where}: ${name} out of bounds`);
      if (type === 2) tags[name] = buf.subarray(at, at + n).toString('latin1').replace(/\0+$/, '');
      else if (type === 3) tags[name] = u16(at);
      else if (type === 4) tags[name] = u32(at);
      else tags[name] = buf.subarray(at, at + size);
    }
    const next = u32(offset + 2 + count * 12);
    if (next !== 0) throw new Problems(`EXIF ${where}: linked IFD (embedded thumbnail) not allowed`);
    return tags;
  };

  const ifd0 = readIfd(u32(4), IFD0_TAGS, 'IFD0');
  const exif = ifd0.ExifIFD === undefined ? {} : readIfd(ifd0.ExifIFD, EXIF_TAGS, 'ExifIFD');
  return { ...ifd0, ...exif };
}

function checkExif(tags, width, height) {
  if (tags.Artist !== ARTIST) throw new Problems(`EXIF: Artist must be "${ARTIST}"`);
  const m = COPYRIGHT.exec(tags.Copyright ?? '');
  if (!m) throw new Problems('EXIF: Copyright missing or malformed');
  if (tags.Orientation !== undefined && tags.Orientation !== 1) throw new Problems('EXIF: Orientation must be 1');
  if (tags.PixelXDimension !== undefined && tags.PixelXDimension !== width) throw new Problems('EXIF: width mismatch');
  if (tags.PixelYDimension !== undefined && tags.PixelYDimension !== height) throw new Problems('EXIF: height mismatch');
  return Number(m[1]);
}

function* chunks(buf, start, end, le) {
  let o = start;
  while (o < end) {
    if (o + 8 > end) throw new Problems('trailing or truncated data');
    let size = le ? buf.readUInt32LE(o + 4) : buf.readUInt32BE(o);
    const type = buf.subarray(le ? o : o + 4, le ? o + 4 : o + 8).toString('latin1');
    let header = 8;
    if (!le && size === 1) {
      size = Number(buf.readBigUInt64BE(o + 8));
      header = 16;
    } else if (!le && size === 0) size = end - o;
    const total = le ? 8 + size + (size & 1) : size;
    const bodyEnd = le ? o + 8 + size : o + size;
    if (size < (le ? 0 : header) || o + total > end) throw new Problems(`box ${type}: out of bounds`);
    yield { type, start: o + header, end: bodyEnd };
    o += total;
  }
}

function inspectWebp(buf) {
  if (buf.readUInt32LE(4) + 8 !== buf.length) throw new Problems('WebP: RIFF size does not match file');
  let width, height, exif;
  const seen = new Set();
  for (const c of chunks(buf, 12, buf.length, true)) {
    if (seen.has(c.type)) throw new Problems(`WebP: duplicate ${c.type} chunk`);
    seen.add(c.type);
    if (c.type === 'VP8X') {
      const flags = buf[c.start];
      if (flags & ~0x18) throw new Problems('WebP: VP8X flags other than EXIF/alpha set');
      width = 1 + buf.readUIntLE(c.start + 4, 3);
      height = 1 + buf.readUIntLE(c.start + 7, 3);
    } else if (c.type === 'VP8 ') {
      width ??= buf.readUInt16LE(c.start + 6) & 0x3fff;
      height ??= buf.readUInt16LE(c.start + 8) & 0x3fff;
    } else if (c.type === 'VP8L') {
      const bits = buf.readUInt32LE(c.start + 1);
      width ??= (bits & 0x3fff) + 1;
      height ??= ((bits >> 14) & 0x3fff) + 1;
    } else if (c.type === 'EXIF') {
      exif = buf.subarray(c.start, c.end);
    } else if (c.type !== 'ALPH') {
      throw new Problems(`WebP: ${c.type.trim()} chunk not allowed`);
    }
  }
  if (!seen.has('VP8 ') && !seen.has('VP8L')) throw new Problems('WebP: no image data');
  return { width, height, exif };
}

function inspectAvif(buf) {
  const top = [...chunks(buf, 0, buf.length, false)];
  const types = top.map((b) => b.type);
  if (types.join(',') !== 'ftyp,meta,mdat') throw new Problems(`AVIF: top-level boxes ${types.join(',')}`);
  const [ftyp, meta, mdat] = top;
  if (buf.subarray(ftyp.start, ftyp.start + 4).toString('latin1') !== 'avif') throw new Problems('AVIF: brand is not avif');

  const items = new Map();
  const extents = [];
  let primary, width, height, iref;
  for (const box of chunks(buf, meta.start + 4, meta.end, false)) {
    const b = buf.subarray(box.start, box.end);
    if (box.type === 'hdlr') {
      if (b.subarray(8, 12).toString('latin1') !== 'pict') throw new Problems('AVIF: handler is not pict');
    } else if (box.type === 'pitm') {
      primary = b[0] === 0 ? b.readUInt16BE(4) : b.readUInt32BE(4);
    } else if (box.type === 'iinf') {
      const start = b[0] === 0 ? 6 : 8;
      for (const infe of chunks(buf, box.start + start, box.end, false)) {
        const e = buf.subarray(infe.start, infe.end);
        const v = e[0];
        if (v < 2) throw new Problems('AVIF: old infe version');
        const id = v === 2 ? e.readUInt16BE(4) : e.readUInt32BE(4);
        const typeAt = v === 2 ? 8 : 10;
        items.set(id, e.subarray(typeAt, typeAt + 4).toString('latin1'));
      }
    } else if (box.type === 'iloc') {
      const v = b[0];
      const offSize = b[4] >> 4;
      const lenSize = b[4] & 15;
      const baseSize = b[5] >> 4;
      const idxSize = v >= 1 ? b[5] & 15 : 0;
      const readN = (o, n) => (n === 0 ? 0 : n === 4 ? b.readUInt32BE(o) : Number(b.readBigUInt64BE(o)));
      let o = 6;
      const count = v < 2 ? b.readUInt16BE(o) : b.readUInt32BE(o);
      o += v < 2 ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const id = v < 2 ? b.readUInt16BE(o) : b.readUInt32BE(o);
        o += v < 2 ? 2 : 4;
        if (v >= 1) {
          if ((b.readUInt16BE(o) & 15) !== 0) throw new Problems('AVIF: item data outside the file');
          o += 2;
        }
        o += 2;
        const base = readN(o, baseSize);
        o += baseSize;
        const n = b.readUInt16BE(o);
        o += 2;
        for (let k = 0; k < n; k++) {
          o += idxSize;
          const off = readN(o, offSize);
          o += offSize;
          const len = readN(o, lenSize);
          o += lenSize;
          extents.push({ id, start: base + off, end: base + off + len });
        }
      }
    } else if (box.type === 'iprp') {
      for (const p of chunks(buf, box.start, box.end, false)) {
        if (p.type === 'ipma') continue;
        if (p.type !== 'ipco') throw new Problems(`AVIF: ${p.type} in iprp not allowed`);
        for (const prop of chunks(buf, p.start, p.end, false)) {
          const d = buf.subarray(prop.start, prop.end);
          if (prop.type === 'ispe') {
            width = d.readUInt32BE(4);
            height = d.readUInt32BE(8);
          } else if (prop.type === 'colr') {
            if (d.subarray(0, 4).toString('latin1') !== 'nclx') throw new Problems('AVIF: embedded colour profile not allowed');
          } else if (!['pixi', 'av1C', 'pasp'].includes(prop.type)) {
            throw new Problems(`AVIF: property ${prop.type} not allowed`);
          }
        }
      }
    } else if (box.type === 'iref') {
      iref = box;
    } else {
      throw new Problems(`AVIF: ${box.type} in meta not allowed`);
    }
  }

  const images = [...items].filter(([, t]) => t === 'av01');
  const exifItems = [...items].filter(([, t]) => t === 'Exif');
  const other = [...items].filter(([, t]) => t !== 'av01' && t !== 'Exif');
  if (other.length) throw new Problems(`AVIF: item type ${other[0][1]} not allowed`);
  if (images.length !== 1 || images[0][0] !== primary) throw new Problems('AVIF: exactly one image item expected');
  if (exifItems.length > 1) throw new Problems('AVIF: more than one Exif item');
  if (iref) {
    for (const r of chunks(buf, iref.start + 4, iref.end, false)) {
      if (r.type !== 'cdsc') throw new Problems(`AVIF: reference ${r.type} not allowed`);
    }
  }

  const covered = extents.reduce((sum, e) => sum + (e.end - e.start), 0);
  for (const e of extents) {
    if (e.start < mdat.start || e.end > mdat.end) throw new Problems('AVIF: item data outside mdat');
  }
  if (covered !== mdat.end - mdat.start) throw new Problems('AVIF: unreferenced bytes in mdat');

  let exif;
  if (exifItems.length) {
    const parts = extents.filter((e) => e.id === exifItems[0][0]);
    const data = Buffer.concat(parts.map((e) => buf.subarray(e.start, e.end)));
    exif = data.subarray(4 + data.readUInt32BE(0));
  }
  return { width, height, exif };
}

export function inspectImage(buf) {
  const errors = [];
  let format, width, height, exif, year;
  try {
    if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
      format = 'webp';
      ({ width, height, exif } = inspectWebp(buf));
    } else if (buf.length >= 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
      format = 'avif';
      ({ width, height, exif } = inspectAvif(buf));
    } else {
      throw new Problems('not an AVIF or WebP file');
    }
    if (!width || !height) throw new Problems('dimensions not found');
    if (Math.max(width, height) > MAX_SIDE) throw new Problems(`larger than ${MAX_SIDE}px (${width}×${height})`);
    if (!exif) throw new Problems('EXIF copyright missing');
    year = checkExif(readTiff(exif), width, height);
  } catch (e) {
    if (!(e instanceof Problems) && !(e instanceof RangeError)) throw e;
    errors.push(e instanceof RangeError ? 'truncated or malformed file' : e.message);
  }
  return { ok: errors.length === 0, errors, format, width, height, year: errors.length ? undefined : year };
}
