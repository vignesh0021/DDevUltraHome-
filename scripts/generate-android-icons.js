/**
 * scripts/generate-android-icons.js
 * Generates Android mipmap launcher icons, adaptive foregrounds, launcher background colors,
 * and splash screen drawables from the official DDevUltraHome transparent logo.
 * 
 * Zero external binary dependencies - pure Node.js (zlib + Buffer).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const LOGO_PATH = path.resolve('public/assets/ddevultrahome-logo-transparent.png');
const RES_DIR = path.resolve('android/app/src/main/res');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function encodePng(rgba, width, height) {
  const stride = width * 4 + 1;
  const filtered = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    filtered[y * stride] = 0; // Filter 0: None
    rgba.copy(filtered, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idatData = zlib.deflateSync(filtered, { level: 9 });

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function decodePng(buffer) {
  let pos = 8;
  const idats = [];
  let width, height;
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(pos + 8);
      height = buffer.readUInt32BE(pos + 12);
    } else if (type === 'IDAT') {
      idats.push(buffer.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idats));
  const rawRgba = Buffer.alloc(width * height * 4);
  const stride = width * 4 + 1;
  for (let y = 0; y < height; y++) {
    decompressed.copy(rawRgba, y * width * 4, y * stride + 1, (y + 1) * stride);
  }
  return { width, height, data: rawRgba };
}

function downsampleBox(srcRgba, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const yStart = Math.floor(dy * yRatio);
    const yEnd = Math.min(Math.floor((dy + 1) * yRatio), srcH);
    for (let dx = 0; dx < dstW; dx++) {
      const xStart = Math.floor(dx * xRatio);
      const xEnd = Math.min(Math.floor((dx + 1) * xRatio), srcW);

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      for (let sy = yStart; sy < yEnd; sy++) {
        const rowOffset = sy * srcW * 4;
        for (let sx = xStart; sx < xEnd; sx++) {
          const idx = rowOffset + sx * 4;
          const a = srcRgba[idx + 3];
          rSum += (srcRgba[idx] * a) / 255;
          gSum += (srcRgba[idx + 1] * a) / 255;
          bSum += (srcRgba[idx + 2] * a) / 255;
          aSum += a;
          count++;
        }
      }

      const dstIdx = (dy * dstW + dx) * 4;
      if (count > 0 && aSum > 0) {
        const avgA = aSum / count;
        dst[dstIdx + 3] = Math.round(avgA);
        dst[dstIdx] = Math.round(rSum / (aSum / 255));
        dst[dstIdx + 1] = Math.round(gSum / (aSum / 255));
        dst[dstIdx + 2] = Math.round(bSum / (aSum / 255));
      }
    }
  }
  return dst;
}

function renderForegroundAdaptive(srcRgba, srcW, srcH, canvasSize) {
  // Safe zone for adaptive icons is center 66.6% (72dp of 108dp)
  const logoSize = Math.round(canvasSize * 0.666);
  const offset = Math.floor((canvasSize - logoSize) / 2);
  const scaledLogo = downsampleBox(srcRgba, srcW, srcH, logoSize, logoSize);

  const canvas = Buffer.alloc(canvasSize * canvasSize * 4, 0); // Transparent canvas
  for (let y = 0; y < logoSize; y++) {
    const srcRow = y * logoSize * 4;
    const dstRow = (offset + y) * canvasSize * 4 + offset * 4;
    scaledLogo.copy(canvas, dstRow, srcRow, srcRow + logoSize * 4);
  }
  return canvas;
}

function renderSplash(srcRgba, srcW, srcH, width, height, bgColor = [11, 15, 25]) {
  const canvas = Buffer.alloc(width * height * 4);
  // Fill background
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = bgColor[0];
    canvas[i * 4 + 1] = bgColor[1];
    canvas[i * 4 + 2] = bgColor[2];
    canvas[i * 4 + 3] = 255;
  }

  // Logo fits in 40% of the smaller dimension
  const logoSize = Math.min(Math.round(Math.min(width, height) * 0.45), 512);
  const scaledLogo = downsampleBox(srcRgba, srcW, srcH, logoSize, logoSize);
  const offsetX = Math.floor((width - logoSize) / 2);
  const offsetY = Math.floor((height - logoSize) / 2);

  // Alpha blend logo over background
  for (let y = 0; y < logoSize; y++) {
    for (let x = 0; x < logoSize; x++) {
      const srcIdx = (y * logoSize + x) * 4;
      const alpha = scaledLogo[srcIdx + 3] / 255;
      if (alpha > 0) {
        const dstIdx = ((offsetY + y) * width + (offsetX + x)) * 4;
        canvas[dstIdx] = Math.round(canvas[dstIdx] * (1 - alpha) + scaledLogo[srcIdx] * alpha);
        canvas[dstIdx + 1] = Math.round(canvas[dstIdx + 1] * (1 - alpha) + scaledLogo[srcIdx + 1] * alpha);
        canvas[dstIdx + 2] = Math.round(canvas[dstIdx + 2] * (1 - alpha) + scaledLogo[srcIdx + 2] * alpha);
      }
    }
  }
  return canvas;
}

export function generateAllIcons() {
  if (!fs.existsSync(LOGO_PATH)) {
    console.error('Logo source not found at:', LOGO_PATH);
    process.exit(1);
  }

  console.log('Loading source logo from:', LOGO_PATH);
  const logoBuf = fs.readFileSync(LOGO_PATH);
  const { width: srcW, height: srcH, data: srcRgba } = decodePng(logoBuf);
  console.log(`Source dimensions: ${srcW}x${srcH}`);

  // Create root assets folder if missing
  fs.mkdirSync(path.resolve('assets'), { recursive: true });
  const icon512 = encodePng(downsampleBox(srcRgba, srcW, srcH, 512, 512), 512, 512);
  fs.writeFileSync(path.resolve('assets/icon.png'), icon512);
  fs.writeFileSync(path.resolve('assets/icon-only.png'), icon512);
  console.log('✔ Generated assets/icon.png (512x512)');

  if (!fs.existsSync(RES_DIR)) {
    console.log(`Android res directory not found at ${RES_DIR}. Skipping native android write.`);
    return;
  }

  // Launcher icon definitions
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(RES_DIR, m.dir);
    fs.mkdirSync(targetDir, { recursive: true });

    // Standard & Round Launcher Icon
    const launcherRgba = downsampleBox(srcRgba, srcW, srcH, m.size, m.size);
    const launcherPng = encodePng(launcherRgba, m.size, m.size);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), launcherPng);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), launcherPng);

    // Adaptive Foreground Icon (with safe margins)
    const fgRgba = renderForegroundAdaptive(srcRgba, srcW, srcH, m.fgSize);
    const fgPng = encodePng(fgRgba, m.fgSize, m.fgSize);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgPng);
    console.log(`✔ Generated ${m.dir}: launcher (${m.size}x${m.size}), fg (${m.fgSize}x${m.fgSize})`);
  }

  // Update ic_launcher_background to dark #0b0f19
  const valuesDir = path.join(RES_DIR, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0b0f19</color>\n</resources>\n`
  );
  console.log('✔ Updated ic_launcher_background.xml (#0b0f19)');

  // Splash screens
  const splashScreens = [
    { dir: 'drawable', w: 480, h: 800 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  ];

  for (const s of splashScreens) {
    const targetDir = path.join(RES_DIR, s.dir);
    fs.mkdirSync(targetDir, { recursive: true });
    const splashRgba = renderSplash(srcRgba, srcW, srcH, s.w, s.h);
    const splashPng = encodePng(splashRgba, s.w, s.h);
    fs.writeFileSync(path.join(targetDir, 'splash.png'), splashPng);
  }
  console.log('✔ Generated all portrait & landscape splash screens');
  console.log('✅ Android brand logo and launcher icons generated successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('generate-android-icons.js')) {
  generateAllIcons();
}
