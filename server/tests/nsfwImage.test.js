import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { createNsfwJpeg } from '../utils/nsfwImage.js';

function createBmp() {
  const bmp = Buffer.alloc(58);
  bmp.write('BM', 0);
  bmp.writeUInt32LE(bmp.length, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(1, 18);
  bmp.writeInt32LE(1, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(4, 34);
  bmp.set([30, 120, 220], 54);
  return bmp;
}

function createIco(png) {
  const ico = Buffer.alloc(22 + png.length);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico[6] = 1;
  ico[7] = 1;
  ico.writeUInt16LE(1, 10);
  ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(png.length, 14);
  ico.writeUInt32LE(22, 18);
  png.copy(ico, 22);
  return ico;
}

const formats = ['jpeg', 'png', 'webp', 'gif', 'avif'];

for (const format of formats) {
  test(`converts ${format.toUpperCase()} to a 299x299 JPEG without modifying source`, async () => {
    const source = await sharp({ create: { width: 24, height: 12, channels: 3, background: '#d84588' } })
      .toFormat(format)
      .toBuffer();
    const original = Buffer.from(source);
    const output = await createNsfwJpeg(source);
    const metadata = await sharp(output).metadata();

    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 299);
    assert.equal(metadata.height, 299);
    assert.deepEqual(source, original);
  });
}

test('converts BMP and ICO to 299x299 JPEG', async () => {
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#45a0d8' } }).png().toBuffer();
  for (const source of [createBmp(), createIco(png)]) {
    const output = await createNsfwJpeg(source);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 299);
    assert.equal(metadata.height, 299);
  }
});
