// Port of me.baier.client.ui.common.components.AlbumRenderer -- the spinning
// vinyl record behind the tachie.

import { Assets } from '../../engine/assets.js';
import { cssColor } from '../../engine/color.js';
import { now } from '../../engine/time.js';

export function renderAlbum(gfx, dst) {
  if (!Assets.bocchi) return;
  const ctx = gfx.ctx;
  const dstCenterX = dst.x + dst.w / 2;
  const dstCenterY = dst.y + dst.h / 2;

  gfx.save();
  gfx.translate(dstCenterX, dstCenterY);
  ctx.rotate(((Math.trunc(now() / 50) % 360) * Math.PI) / 180);
  gfx.translate(-dstCenterX, -dstCenterY);

  const baseSize = Math.min(dst.w, dst.h);
  const recordOuterRadius = baseSize * 0.48;
  const albumArtDiscRadius = recordOuterRadius * 0.98;
  const albumArtRadius = recordOuterRadius * 0.65;
  const labelRadius = recordOuterRadius * 0.22;

  gfx.drawCircle(dstCenterX, dstCenterY, recordOuterRadius, 0xff050505);
  gfx.drawCircle(dstCenterX, dstCenterY, albumArtDiscRadius, 0xff1a1a1a);
  gfx.drawCircle(dstCenterX, dstCenterY, albumArtRadius, 0x80ffffff);

  // Shine: radial gradient anchored up and to the right of the disc.
  const shineOffsetX = dstCenterX + albumArtDiscRadius * 0.1;
  const shineOffsetY = dstCenterY - albumArtDiscRadius * 0.3;
  const shineEffectRadius = albumArtDiscRadius * 1.2;
  const shine = ctx.createRadialGradient(
    shineOffsetX,
    shineOffsetY,
    0,
    shineOffsetX,
    shineOffsetY,
    shineEffectRadius
  );
  shine.addColorStop(0, cssColor(0x33ffffff));
  shine.addColorStop(0.4, cssColor(0x1affffff));
  shine.addColorStop(1, cssColor(0x001a1a1a));
  ctx.save();
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(dstCenterX, dstCenterY, albumArtDiscRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const grooveStrokeWidth = Math.max(0.5, 0.75 * (baseSize / 600));
  const grooveStep = Math.max(1.0, 1.8 * (baseSize / 600));
  const grooveStartOffset = Math.max(1.5, 3 * (baseSize / 600));

  gfx.drawCircle(dstCenterX, dstCenterY, labelRadius + grooveStartOffset, 0x981a1a1a);

  for (
    let r = labelRadius + grooveStartOffset;
    r < albumArtRadius - grooveStartOffset / 2;
    r += grooveStep
  ) {
    gfx.drawCircleStroke(dstCenterX, dstCenterY, r, grooveStrokeWidth, 0x1fffffff);
  }
  for (
    let r = albumArtRadius + grooveStartOffset;
    r < albumArtDiscRadius - grooveStartOffset / 2;
    r += grooveStep
  ) {
    gfx.drawCircleStroke(dstCenterX, dstCenterY, r, grooveStrokeWidth, 0x1fffffff);
  }

  // Album art: the Java code uses the texture as a shader with
  //   translate(dx, dy - dst.h / 4.5) then preScale(scale * 1.6)
  // so the inverse mapping gives the source rectangle for the disc.
  const image = Assets.bocchi;
  const imgW = image.width;
  const imgH = image.height;
  const scale = imgW / imgH >= 1.0 ? (2 * albumArtRadius) / imgH : (2 * albumArtRadius) / imgW;
  const scaledWidth = imgW * scale;
  const scaledHeight = imgH * scale;
  const dx = dstCenterX - scaledWidth / 2;
  const dy = dstCenterY - scaledHeight / 2;
  const shaderScale = scale * 1.6;
  const shaderDy = dy - dst.h / 4.5;

  const sx = (dstCenterX - albumArtRadius - dx) / shaderScale;
  const sy = (dstCenterY - albumArtRadius - shaderDy) / shaderScale;
  const sw = (2 * albumArtRadius) / shaderScale;
  const sh = (2 * albumArtRadius) / shaderScale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(dstCenterX, dstCenterY, albumArtRadius, 0, Math.PI * 2);
  ctx.clip();
  gfx.drawImageRect(
    image,
    sx,
    sy,
    sw,
    sh,
    dstCenterX - albumArtRadius,
    dstCenterY - albumArtRadius,
    2 * albumArtRadius,
    2 * albumArtRadius,
    1
  );
  ctx.restore();

  const innerBorderWidth = Math.max(1, 2 * (baseSize / 600));
  gfx.drawCircleStroke(
    dstCenterX,
    dstCenterY,
    albumArtRadius - innerBorderWidth / 2,
    5,
    0xffffffff
  );

  gfx.restore();
}
