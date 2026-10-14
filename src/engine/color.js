// Port of me.baier.utils.ColorUtil + net.minecraft.util.ARGB helpers.
// Colours are plain 32 bit ARGB integers exactly like the Java code uses.

function lerp(t, a, b) {
  return a + (b - a) * t;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** net.minecraft.util.Mth.lerp */
export function mlerp(t, a, b) {
  return a + (b - a) * t;
}

/** net.minecraft.util.ARGB.lerp -- truncates each channel like the Java cast to int. */
export function argbLerp(t, from, to) {
  const a = Math.trunc(lerp(t, (from >>> 24) & 0xff, (to >>> 24) & 0xff));
  const r = Math.trunc(lerp(t, (from >>> 16) & 0xff, (to >>> 16) & 0xff));
  const g = Math.trunc(lerp(t, (from >>> 8) & 0xff, (to >>> 8) & 0xff));
  const b = Math.trunc(lerp(t, from & 0xff, to & 0xff));
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

/** ColorUtil.lerpColor */
export function lerpColor(from, to, t) {
  return argbLerp(clamp(t, 0, 1), from, to);
}

/** ColorUtil.replaceAlpha -- note it masks with 16777215 exactly like Java. */
export function replaceAlpha(color, alpha) {
  return (((color & 16777215) | (Math.trunc(alpha) << 24)) >>> 0);
}

export function alpha(color) {
  return (color >>> 24) & 0xff;
}

/** CSS colour string for a canvas fillStyle. */
export function cssColor(color) {
  const a = ((color >>> 24) & 0xff) / 255;
  const r = (color >>> 16) & 0xff;
  const g = (color >>> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}
