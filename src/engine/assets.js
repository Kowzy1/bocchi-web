// Image / SVG loading plus the tint + dilate helpers the tachie and the button
// icons need. Skia applies these with a paint color filter and an image filter;
// here they are pre-rendered once per (size, colour) into a small cache.

import { cssColor } from './color.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load ${src}`));
    image.src = src;
  });
}

export const Assets = {
  bocchi: null,
  logo: null,
  loading: null,
  icons: {},
};

export async function loadAssets() {
  const [bocchi, logo, loading, single, multi, alt, option, lang, quit] =
    await Promise.all([
      loadImage('/assets/bocchi.png'),
      loadImage('/assets/logo.png'),
      loadImage('/assets/bocchi_loading.png'),
      loadImage('/assets/single.svg'),
      loadImage('/assets/multi.svg'),
      loadImage('/assets/alt.svg'),
      loadImage('/assets/option.svg'),
      loadImage('/assets/lang.svg'),
      loadImage('/assets/quit.svg'),
    ]);
  Assets.bocchi = bocchi;
  Assets.logo = logo;
  Assets.loading = loading;
  Assets.icons = { single, multi, alt, option, lang, quit };
  return Assets;
}

const tintCache = new Map();
const TINT_CACHE_LIMIT = 12;

/**
 * Renders `image` at the device resolution it will occupy and optionally
 * recolours it, mirroring Skia's `ColorFilter.makeBlend(color, SRC_IN)`.
 * Returns a canvas that can be drawn 1:1 in GUI units.
 */
export function tintedSprite(image, widthGui, heightGui, color, scale) {
  const dw = Math.max(1, Math.round(widthGui * scale));
  const dh = Math.max(1, Math.round(heightGui * scale));
  const key = `${image.src}|${dw}x${dh}|${color === null ? 'none' : color}`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, dw, dh);
  if (color !== null && color !== undefined) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = cssColor(color);
    ctx.fillRect(0, 0, dw, dh);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (tintCache.size >= TINT_CACHE_LIMIT) {
    tintCache.delete(tintCache.keys().next().value);
  }
  tintCache.set(key, canvas);
  return canvas;
}

/**
 * Skia `ImageFilter.makeDilate(rx, ry)` with a radius of one is a 3x3 maximum
 * filter on the alpha channel; the union of the nine shifted copies is the same
 * shape, so that is what gets baked into the returned canvas. Drawing it once
 * (instead of nine times) keeps the paint alpha semantics identical.
 *
 * Returns `{ canvas, pad }` where `pad` is the GUI-space overhang on each side.
 */
export function dilatedTintedSprite(image, widthGui, heightGui, color, scale) {
  const base = tintedSprite(image, widthGui, heightGui, color, scale);
  const r = Math.max(1, Math.round(scale));
  const key = `${base.width}x${base.height}|${color}|${r}`;
  const cached = dilateCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = base.width + 2 * r;
  canvas.height = base.height + 2 * r;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const [ox, oy] of DILATE_1_OFFSETS) {
    ctx.drawImage(base, r + ox * r, r + oy * r);
  }

  const result = { canvas, pad: r / scale };
  if (dilateCache.size >= 6) dilateCache.delete(dilateCache.keys().next().value);
  dilateCache.set(key, result);
  return result;
}

const dilateCache = new Map();

export const DILATE_1_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
