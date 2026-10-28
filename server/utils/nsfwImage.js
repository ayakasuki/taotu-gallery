import sharp from 'sharp';
import { decode as decodeBmp } from 'bmp-ts';
import { decodeIco, isIco } from 'icojs';

const NSFW_IMAGE_SIZE = 299;

export async function createNsfwJpeg(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('待审核图片为空');
  }

  let input = buffer;
  if (isIco(buffer)) {
    const images = await decodeIco(buffer, 'image/png');
    const largestImage = images.sort((left, right) => right.width * right.height - left.width * left.height)[0];
    if (!largestImage?.buffer) throw new Error('ICO 图片中没有可审核的图像');
    input = Buffer.from(largestImage.buffer);
  } else if (buffer.subarray(0, 2).toString('ascii') === 'BM') {
    const bmp = decodeBmp(buffer, { toRGBA: true });
    return sharp(bmp.data, { raw: { width: bmp.width, height: bmp.height, channels: 4 } })
      .resize(NSFW_IMAGE_SIZE, NSFW_IMAGE_SIZE, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 88 })
      .toBuffer();
  }

  return sharp(input, { animated: false, failOn: 'error' })
    .rotate()
    .resize(NSFW_IMAGE_SIZE, NSFW_IMAGE_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 88 })
    .toBuffer();
}
