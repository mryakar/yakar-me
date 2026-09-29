import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { inspectImage, copyrightText } from '../scripts/lib/image-meta.mjs';
import { encodeVariant } from '../scripts/lib/variants.mjs';

const exif = { IFD0: { Artist: 'Ahmet Yakar', Copyright: copyrightText(2026) } };
const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#c8a465' } })
  .withExif({
    IFD0: { Make: 'FUJIFILM', Model: 'X-E5', Artist: 'Someone' },
    IFD2: { SerialNumber: '5B003943' },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '22/1 18/1 26/1' },
  })
  .jpeg()
  .toBuffer();
const small = () => sharp(source).resize({ width: 320 });

for (const format of ['avif', 'webp']) {
  test(`${format}: ham piksel yolundan üretilen varyant geçer`, async () => {
    const { buffer, width, height } = await encodeVariant(source, { width: 320, format, year: 2026 });
    const r = inspectImage(buffer);
    assert.deepEqual(r.errors, []);
    assert.equal(r.format, format);
    assert.equal(r.width, width);
    assert.equal(r.height, height);
    assert.equal(r.year, 2026);
  });

  test(`${format}: kaynağın meta verisi korunmuşsa reddedilir`, async () => {
    assert.equal(inspectImage(await small().keepMetadata()[format]().toBuffer()).ok, false);
  });

  test(`${format}: bağlı IFD (gömülü önizleme) reddedilir`, async () => {
    const { buffer } = await encodeVariant(source, { width: 320, format, year: 2026 });
    const tiff = buffer.indexOf('II*\0', 0, 'latin1');
    const ifd0 = tiff + buffer.readUInt32LE(tiff + 4);
    buffer.writeUInt32LE(8, ifd0 + 2 + buffer.readUInt16LE(ifd0) * 12);
    assert.match(inspectImage(buffer).errors[0], /linked IFD/);
  });

  test(`${format}: gömülü renk profili reddedilir`, async () => {
    const r = inspectImage(await small().withIccProfile('p3').withExif(exif)[format]().toBuffer());
    assert.equal(r.ok, false);
  });

  test(`${format}: telif yoksa reddedilir`, async () => {
    assert.match(inspectImage(await small()[format]().toBuffer()).errors[0], /copyright/i);
  });

  test(`${format}: yanlış Artist reddedilir`, async () => {
    const r = inspectImage(await small().withExif({ IFD0: { Artist: 'Someone', Copyright: copyrightText(2026) } })[format]().toBuffer());
    assert.match(r.errors[0], /Artist/);
  });

  test(`${format}: izin listesi dışındaki EXIF etiketi reddedilir`, async () => {
    const r = inspectImage(await small().withExif({ IFD0: { ...exif.IFD0, Make: 'FUJIFILM' } })[format]().toBuffer());
    assert.match(r.errors[0], /not allowed/);
  });

  test(`${format}: sona eklenmiş bayt reddedilir`, async () => {
    const { buffer } = await encodeVariant(source, { width: 320, format, year: 2026 });
    assert.equal(inspectImage(Buffer.concat([buffer, Buffer.from('GPS 22.3 114.1')])).ok, false);
  });

  test(`${format}: kesik dosya reddedilir`, async () => {
    const { buffer } = await encodeVariant(source, { width: 320, format, year: 2026 });
    assert.equal(inspectImage(buffer.subarray(0, buffer.length >> 1)).ok, false);
  });
}

test('en uzun kenar sınırı aşılırsa reddedilir', async () => {
  const big = await sharp({ create: { width: 2600, height: 10, channels: 3, background: '#000' } })
    .withExif(exif)
    .webp()
    .toBuffer();
  assert.match(inspectImage(big).errors[0], /larger than/);
});

test('JPEG sunulan biçim değil', async () => {
  assert.equal(inspectImage(await small().withExif(exif).jpeg().toBuffer()).ok, false);
});

test('bozuk girdi istisna fırlatmaz, reddedilir', () => {
  assert.equal(inspectImage(Buffer.from('RIFF\x04\x00\x00\x00WEBP')).ok, false);
  assert.equal(inspectImage(Buffer.alloc(3)).ok, false);
});
