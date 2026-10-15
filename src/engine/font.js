// Port of me.baier.graphics.font.SkiaFont / SkiaFontRenderer / FontSet.
//
// The Java renderer halves the canvas (canvas.scale(0.5, 0.5)) and draws at
// (x * 2, (y + getHeight()) * 2), so a font created with `size` is really drawn
// `size / 2` pixels tall on screen and every metric is divided by two as well.
// `screenSize` below is that effective size; the metrics module supplies the raw
// hhea/hmtx numbers so widths and heights do not depend on the browser.

import { FONT_METRICS } from './metrics.js';
import { cssColor } from './color.js';

const FAMILIES = {
  SH_LIGHT: 'Bocchi SH Light',
  SH_REGULAR: 'Bocchi SH Regular',
  SH_HEAVY: 'Bocchi SH Heavy',
  SH_NORMAL: 'Bocchi SH Normal',
  SH_BOLD: 'Bocchi SH Bold',
  RADIKAL_REGULAR: 'Bocchi Radikal',
};

class FontRenderer {
  constructor(metrics, family, size) {
    this.metrics = metrics;
    this.family = family;
    this.size = size;
    this.screenSize = size / 2;
    // The shipped Source Han Sans subsets only contain Latin glyphs, so CJK
    // labels fall back to a system font. The advance-width fallback below keeps
    // the measured width consistent with the full-width glyphs those fonts draw.
    this.cssFont = `${size}px "${family}", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Source Han Sans SC", sans-serif`;
    this.widthCache = new Map();
  }

  /** SkiaFontRenderer#getHeight */
  getHeight() {
    const m = this.metrics;
    return ((m.lineGap + m.ascent + m.descent) * this.screenSize) / m.upem;
  }

  getHalfHeight() {
    return this.getHeight() / 2;
  }

  /** Skia FontMetrics.getAscent() at the *unhalved* font size, as the Java code uses it. */
  metricsAscent() {
    const m = this.metrics;
    return (-m.ascent * this.size) / m.upem;
  }

  metricsDescent() {
    const m = this.metrics;
    return (-m.descent * this.size) / m.upem;
  }

  /** SkiaFontRenderer#getStringWidth(String) */
  charWidth(ch) {
    let width = this.widthCache.get(ch);
    if (width === undefined) {
      const advance = this.metrics.advances[ch.charCodeAt(0)];
      // Glyphs missing from the Latin-only subset (e.g. CJK) render at their
      // natural full-width advance of one em.
      const units = advance === undefined ? this.metrics.upem : advance;
      width = (units * this.screenSize) / this.metrics.upem;
      this.widthCache.set(ch, width);
    }
    return width;
  }

  getStringWidth(text, spacing = 0) {
    if (text === null || text === undefined) return 0;
    let width = 0;
    for (let i = 0; i < text.length; i++) width += this.charWidth(text[i]);
    if (spacing !== 0) width += spacing * text.length;
    return width;
  }

  /**
   * On-screen width of `text` as the browser actually lays it out. Unlike
   * getStringWidth this accounts for glyphs drawn by a fallback font (CJK, the
   * password bullet, ...), whose advances are not in the subset metrics. Used
   * where the measured width must match the drawn glyphs exactly, e.g. the text
   * caret.
   */
  measureWidth(gfx, text) {
    if (!text) return 0;
    const ctx = gfx.ctx;
    ctx.save();
    ctx.font = this.cssFont;
    const width = ctx.measureText(text).width / 2;
    ctx.restore();
    return width;
  }

  /**
   * SkiaFontRenderer#drawString(text, x, y, color, spacing)
   * `y` is the top of the line box; the baseline lands at y + getHeight().
   */
  drawString(gfx, text, x, y, color, spacing = 0) {
    if (text === null || text === undefined || text.length === 0) return;
    const ctx = gfx.ctx;
    const baseline = (y + this.getHeight()) * 2;
    ctx.save();
    ctx.scale(0.5, 0.5);
    ctx.font = this.cssFont;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = cssColor(color);
    if (spacing !== 0) {
      let penX = x;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        ctx.fillText(ch, penX * 2, baseline);
        penX += this.charWidth(ch) + spacing;
      }
    } else {
      ctx.fillText(text, x * 2, baseline);
    }
    ctx.restore();
  }

  /** Same as drawString but with an outer canvas filter, used by the splash label. */
  drawStringWithMask(gfx, text, x, y, color, spacing, drawMask) {
    if (text === null || text === undefined || text.length === 0) return;
    const ctx = gfx.ctx;
    const baseline = (y + this.getHeight()) * 2;
    ctx.save();
    ctx.scale(0.5, 0.5);
    ctx.font = this.cssFont;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = cssColor(color);
    if (drawMask) drawMask(ctx);
    if (spacing !== 0) {
      let penX = x;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        ctx.fillText(ch, penX * 2, baseline);
        penX += this.charWidth(ch) + spacing;
      }
    } else {
      ctx.fillText(text, x * 2, baseline);
    }
    ctx.restore();
  }
}

class SkiaFont {
  constructor(name) {
    this.name = name;
    this.metrics = FONT_METRICS[name];
    this.family = FAMILIES[name];
    this.renderers = new Map();
  }

  getFont(size) {
    let renderer = this.renderers.get(size);
    if (!renderer) {
      renderer = new FontRenderer(this.metrics, this.family, size);
      this.renderers.set(size, renderer);
    }
    return renderer;
  }
}

export const FontSet = {
  RADIKAL_REGULAR: new SkiaFont('RADIKAL_REGULAR'),
  SH_LIGHT: new SkiaFont('SH_LIGHT'),
  SH_REGULAR: new SkiaFont('SH_REGULAR'),
  SH_HEAVY: new SkiaFont('SH_HEAVY'),
  SH_NORMAL: new SkiaFont('SH_NORMAL'),
  SH_BOLD: new SkiaFont('SH_BOLD'),
};
