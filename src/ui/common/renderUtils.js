// Port of me.baier.utils.RenderUtils.

import { cssColor } from '../../engine/color.js';

export function drawTextBox(
  gfx,
  font,
  text,
  x,
  y,
  rectColor,
  textColor,
  spacing,
  expandX,
  expandY,
  radius
) {
  const textContentWidth = font.getStringWidth(text) + spacing * text.length;
  const boxFinalWidth = textContentWidth * expandX;
  const boxFinalHeight = font.getHeight() * expandY;
  const boxDrawX = x - (textContentWidth * (expandX - 1)) / 2;
  const boxDrawY = y - (font.getHeight() * (expandY - 1)) / 2;

  if (radius === 0) {
    gfx.drawRect(boxDrawX, boxDrawY, boxFinalWidth, boxFinalHeight, rectColor);
  } else {
    gfx.drawRoundRect(boxDrawX, boxDrawY, boxFinalWidth, boxFinalHeight, radius, rectColor);
  }
  font.drawString(gfx, text, x, y - font.getHalfHeight() / 4, textColor, spacing);
}

export function drawTextStrokeBox(
  gfx,
  font,
  text,
  x,
  y,
  rectColor,
  textColor,
  spacing,
  expandX,
  expandY,
  radius,
  strokeSize
) {
  const textContentWidth = font.getStringWidth(text) + spacing * text.length;
  const boxFinalWidth = textContentWidth * expandX;
  const boxFinalHeight = font.getHeight() * expandY;
  const boxDrawX = x - (textContentWidth * (expandX - 1)) / 2;
  const boxDrawY = y - (font.getHeight() * (expandY - 1)) / 2;

  const ctx = gfx.ctx;
  ctx.save();
  ctx.strokeStyle = cssColor(rectColor);
  ctx.lineWidth = strokeSize;
  if (radius === 0) {
    ctx.strokeRect(boxDrawX, boxDrawY, boxFinalWidth, boxFinalHeight);
  } else {
    const r = Math.min(radius, Math.min(boxFinalWidth, boxFinalHeight) / 2);
    ctx.beginPath();
    ctx.moveTo(boxDrawX + r, boxDrawY);
    ctx.arcTo(boxDrawX + boxFinalWidth, boxDrawY, boxDrawX + boxFinalWidth, boxDrawY + boxFinalHeight, r);
    ctx.arcTo(
      boxDrawX + boxFinalWidth,
      boxDrawY + boxFinalHeight,
      boxDrawX,
      boxDrawY + boxFinalHeight,
      r
    );
    ctx.arcTo(boxDrawX, boxDrawY + boxFinalHeight, boxDrawX, boxDrawY, r);
    ctx.arcTo(boxDrawX, boxDrawY, boxDrawX + boxFinalWidth, boxDrawY, r);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  font.drawString(gfx, text, x, y - font.getHalfHeight() / 4, textColor, spacing);
}
