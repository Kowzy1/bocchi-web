// Canvas backend that mirrors the handful of Skia operations the mod uses.
//
// The important part is layer handling: Skia's saveLayer/saveLayerAlpha rasterises
// the layer in device space and composites it back with an alpha and/or an image
// filter. Doing the same in Canvas2D means rendering into an offscreen canvas and
// drawing that back, which is what pushLayer/popLayer do here. That keeps
// overlapping translucent content (the whole intro fade) identical instead of
// darkening where shapes overlap, which plain globalAlpha would do.

import { cssColor } from './color.js';

const pools = new Map();

function acquire(w, h) {
  const key = `${w}x${h}`;
  const list = pools.get(key);
  if (list && list.length) return list.pop();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function release(canvas) {
  const key = `${canvas.width}x${canvas.height}`;
  let list = pools.get(key);
  if (!list) {
    list = [];
    pools.set(key, list);
  }
  if (list.length < 6) list.push(canvas);
}

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.base = canvas.getContext('2d');
    this.ctx = this.base;
    this.scale = 1;
    this.width = 0;
    this.height = 0;
    this.layers = [];
    this.clips = [];
  }

  setSize(deviceWidth, deviceHeight, scale) {
    if (this.canvas.width !== deviceWidth) this.canvas.width = deviceWidth;
    if (this.canvas.height !== deviceHeight) this.canvas.height = deviceHeight;
    this.base = this.canvas.getContext('2d');
    this.ctx = this.base;
    this.width = deviceWidth;
    this.height = deviceHeight;
    this.scale = scale;
  }

  /** Equivalent of SkiaContext#begin(): reset and apply the GUI scale. */
  begin() {
    this.layers.length = 0;
    this.clips.length = 0;
    this.ctx = this.base;
    const ctx = this.base;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.scale(this.scale, this.scale);
  }

  save() {
    this.ctx.save();
  }

  restore() {
    this.ctx.restore();
  }

  translate(x, y) {
    this.ctx.translate(x, y);
  }

  scaleBy(x, y) {
    this.ctx.scale(x, y);
  }

  /** SkiaContext#startRotate -- degrees, clockwise in the y-down space. */
  startRotate(x, y, deg) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.translate(-x, -y);
  }

  stopRotate() {
    this.ctx.restore();
  }

  pushClip(x, y, w, h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    this.clips.push(true);
  }

  popClip() {
    this.clips.pop();
    this.ctx.restore();
  }

  /**
   * saveLayer / saveLayerAlpha. `bounds` is in local coordinates (or null for
   * "everything"). `blurSigma` is a Skia blur sigma in local units.
   */
  pushLayer(bounds, { alpha = null, blurSigma = 0 } = {}) {
    const parent = this.ctx;
    const matrix = parent.getTransform();

    let x = 0;
    let y = 0;
    let w = this.width;
    let h = this.height;
    if (bounds) {
      const p0 = matrix.transformPoint(new DOMPoint(bounds.x, bounds.y));
      const p1 = matrix.transformPoint(
        new DOMPoint(bounds.x + bounds.w, bounds.y + bounds.h)
      );
      x = Math.floor(Math.min(p0.x, p1.x));
      y = Math.floor(Math.min(p0.y, p1.y));
      const right = Math.ceil(Math.max(p0.x, p1.x));
      const bottom = Math.ceil(Math.max(p0.y, p1.y));
      w = right - x;
      h = bottom - y;
    }
    // Clamp to the surface, like Skia's layer bounds handling.
    const cx0 = Math.max(0, Math.min(this.width, x));
    const cy0 = Math.max(0, Math.min(this.height, y));
    const cx1 = Math.max(0, Math.min(this.width, x + w));
    const cy1 = Math.max(0, Math.min(this.height, y + h));
    x = cx0;
    y = cy0;
    w = Math.max(1, cx1 - cx0);
    h = Math.max(1, cy1 - cy0);

    const layerCanvas = acquire(w, h);
    const lctx = layerCanvas.getContext('2d');
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = 'source-over';
    lctx.filter = 'none';
    lctx.clearRect(0, 0, w, h);
    lctx.save();
    lctx.translate(-x, -y);
    lctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);

    this.layers.push({ parent, canvas: layerCanvas, x, y, alpha, blurSigma });
    this.ctx = lctx;
  }

  popLayer() {
    const entry = this.layers.pop();
    if (entry.passthrough) return;
    const parent = entry.parent;
    this.ctx = parent;
    parent.save();
    parent.setTransform(1, 0, 0, 1, 0, 0);
    if (entry.alpha !== null) parent.globalAlpha = entry.alpha / 255;
    if (entry.blurSigma > 0) parent.filter = `blur(${entry.blurSigma * this.scale}px)`;
    parent.drawImage(entry.canvas, entry.x, entry.y);
    parent.restore();
    release(entry.canvas);
  }

  /* ------------------------------------------------------------------ */
  /* SkiaRenderEngine equivalents                                       */
  /* ------------------------------------------------------------------ */

  drawRect(x, y, w, h, color) {
    if (!(w > 0) || !(h > 0)) return;
    const ctx = this.ctx;
    ctx.fillStyle = cssColor(color);
    ctx.fillRect(x, y, w, h);
  }

  drawRectLTRB(l, t, r, b, color) {
    if (!(r > l) || !(b > t)) return;
    const ctx = this.ctx;
    ctx.fillStyle = cssColor(color);
    ctx.fillRect(l, t, r - l, b - t);
  }

  drawRoundRect(x, y, w, h, radius, color) {
    if (!(w > 0) || !(h > 0)) return;
    const ctx = this.ctx;
    ctx.fillStyle = cssColor(color);
    ctx.beginPath();
    const r = Math.min(radius, Math.min(w, h) / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  drawCircle(cx, cy, radius, color) {
    if (!(radius > 0)) return;
    const ctx = this.ctx;
    ctx.fillStyle = cssColor(color);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCircleStroke(cx, cy, radius, width, color) {
    if (!(radius > 0) || !(width > 0)) return;
    const ctx = this.ctx;
    ctx.strokeStyle = cssColor(color);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawLine(x0, y0, x1, y1, color, width) {
    const ctx = this.ctx;
    ctx.strokeStyle = cssColor(color);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  /** Skia's PathEffect.makeDash + drawLine. */
  drawDashLine(x0, y0, x1, y1, interval, color, width) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = cssColor(color);
    ctx.lineWidth = width;
    ctx.setLineDash([interval, interval]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  /** SkiaRenderEngine.drawImage -- plain stretch of the whole image. */
  drawImage(image, dx, dy, dw, dh, opacity = 1) {
    if (!image || !(dw > 0) || !(dh > 0)) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.restore();
  }

  /** SkiaRenderEngine.drawImage with a source rectangle. */
  drawImageRect(image, sx, sy, sw, sh, dx, dy, dw, dh, opacity = 1) {
    if (!image || !(dw > 0) || !(dh > 0) || !(sw > 0) || !(sh > 0)) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  /** Draws a pre-rendered canvas 1:1 (used for tinted / dilated sprites). */
  drawSprite(sprite, dx, dy, dw, dh) {
    if (!sprite) return;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprite, dx, dy, dw, dh);
  }

  /**
   * canvas.drawRectShadow(rect, dx, dy, sigma, color)
   * Skia blurs with `sigma` as the gaussian standard deviation, which is also
   * what the CSS blur() filter parameter means.
   */
  drawRectShadow(x, y, w, h, dx, dy, sigma, color) {
    if (!(w > 0) || !(h > 0)) return;
    const ctx = this.ctx;
    ctx.save();
    if (sigma > 0) ctx.filter = `blur(${sigma * this.scale}px)`;
    ctx.fillStyle = cssColor(color);
    ctx.fillRect(x + dx, y + dy, w, h);
    ctx.restore();
  }

  /**
   * A Skia blur mask filter in SOLID mode (blur clipped to the shape), used by
   * the splash "TAP TO START" label. Implemented exactly: draw blurred, then
   * keep only what the crisp shape covers.
   */
  withSolidBlur(sigma, drawShape) {
    if (!(sigma > 0)) {
      drawShape(this);
      return;
    }
    const ctx = this.ctx;
    const matrix = ctx.getTransform();
    // The scratch surface covers exactly the current target (the screen, or the
    // offscreen layer we are currently drawing into).
    const entry = this.layers[this.layers.length - 1];
    const w = entry && entry.canvas ? entry.canvas.width : this.width;
    const h = entry && entry.canvas ? entry.canvas.height : this.height;
    const scratch = acquire(w, h);
    const sctx = scratch.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
    sctx.filter = 'none';
    sctx.clearRect(0, 0, w, h);
    sctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);

    const proxy = this.spawn(sctx);
    sctx.save();
    sctx.filter = `blur(${sigma * this.scale}px)`;
    drawShape(proxy);
    sctx.restore();

    sctx.save();
    sctx.globalCompositeOperation = 'destination-in';
    drawShape(proxy);
    sctx.restore();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
    release(scratch);
  }

  /** A shallow view of this Gfx that draws into a different 2D context. */
  spawn(ctx) {
    const proxy = Object.create(this);
    proxy.ctx = ctx;
    return proxy;
  }
}
