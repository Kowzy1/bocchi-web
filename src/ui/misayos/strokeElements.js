// Port of me.baier.client.ui.mainmenu.misayos.StrokeElementsComponent.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { mlerp, replaceAlpha } from '../../engine/color.js';
import { BaseComponent } from './base.js';

export class StrokeElementsComponent extends BaseComponent {
  initAnimations(frame, lastAnimation) {
    this.line1Animation = BezierAnimation.createFloat(0, 1, 600, CP.CUBIC_IN);
    this.line2Animation = BezierAnimation.createFloat(0, 1, 760, CP.CUBIC_OUT);
    this.blindsAnimation = BezierAnimation.createFloat(0, 1, 1000, CP.EASE_OUT);
    lastAnimation.then(this.line1Animation, 0.1);
    this.line1Animation.then(this.line2Animation, 0.1);
    this.line2Animation.then(this.blindsAnimation, 0.1);
    this.animations = [this.line1Animation, this.line2Animation, this.blindsAnimation];
    return this.blindsAnimation;
  }

  render(gfx, frame) {
    const screenWidth = frame.scaledWidth;
    const screenHeight = frame.scaledHeight;
    const blockPos1 = frame.block1Pos;
    const blockSize = frame.block1Size;

    const line1Start = {
      x: blockPos1.x + blockSize * 0.1,
      y: blockPos1.y * 0.1,
    };
    const line1End = {
      x: blockPos1.x + blockSize * 0.72,
      y: blockPos1.y,
    };
    const line2Start = {
      x: blockPos1.x + blockSize * 0.1,
      y: blockPos1.y + blockSize * 1.1,
    };
    const line2End = {
      x: blockPos1.x + blockSize * 0.72,
      y: blockPos1.y + 5,
    };

    const line1Value = this.line1Animation.currentValue;
    const line2Value = this.line2Animation.currentValue;

    const currentLine1End = {
      x: mlerp(line1Value, line1Start.x, line1End.x),
      y: mlerp(line1Value, line1Start.y, line1End.y),
    };
    const currentLine2End = {
      x: mlerp(line2Value, line2Start.x, line2End.x),
      y: mlerp(line2Value, line2Start.y, line2End.y),
    };

    const center = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const rect2Pos = center(line2End, line1End);
    const currentRect2PosForLine1 = center(currentLine1End, {
      x: mlerp(line1Value, line2Start.x, line2End.x),
      y: mlerp(line1Value, line2Start.y, line2End.y),
    });
    const currentRect2PosForLine2 = center(
      {
        x: mlerp(line2Value, line1Start.x, line1End.x),
        y: mlerp(line2Value, line1Start.y, line1End.y),
      },
      currentLine2End
    );

    const rect2Size = 5;
    const line1Alpha = Math.round(mlerp(line1Value, 0, 255));
    const line2Alpha = Math.round(mlerp(line2Value, 0, 255));

    gfx.drawDashLine(
      line1Start.x,
      line1Start.y,
      currentRect2PosForLine1.x + 1,
      currentLine1End.y,
      3.5,
      replaceAlpha(0xffffffff, line1Alpha),
      0.5
    );
    gfx.drawDashLine(
      line2Start.x,
      line2Start.y,
      currentRect2PosForLine2.x + 1,
      currentLine2End.y,
      3.5,
      replaceAlpha(0xffffffff, line2Alpha),
      0.5
    );

    const currentRect2Size = mlerp(line2Value, 0, rect2Size);
    gfx.drawRect(
      line1Start.x - 4,
      line1Start.y - 4,
      2.5,
      2.5,
      replaceAlpha(0xffffffff, line1Alpha)
    );
    gfx.drawRect(
      rect2Pos.x + 1,
      rect2Pos.y - rect2Size / 2,
      rect2Size,
      currentRect2Size,
      replaceAlpha(0xffffffff, line2Alpha)
    );

    const rect3Size = 8;
    const currentRect3Size = mlerp(line2Value, 0, rect3Size);
    gfx.drawRect(
      line2Start.x - rect3Size,
      line2Start.y + 1,
      rect3Size,
      currentRect3Size,
      replaceAlpha(0xffffffff, line2Alpha)
    );

    const currentSpacing = 7 - mlerp(this.blindsAnimation.currentValue, 0, 5);
    const blindAlpha = Math.round(mlerp(this.blindsAnimation.currentValue, 0, 255));

    this.drawBlindsRect(
      gfx,
      {
        x: line2Start.x + rect3Size,
        y: line2Start.y + 1,
        w: rect3Size * 6,
        h: currentRect3Size,
      },
      2,
      currentSpacing,
      48,
      replaceAlpha(0xffffffff, blindAlpha)
    );

    this.drawBlindsRect(
      gfx,
      { x: screenWidth * 0.8, y: screenHeight * 0.08, w: rect3Size * 8, h: rect3Size },
      2,
      currentSpacing,
      48,
      replaceAlpha(0xffffffff, blindAlpha)
    );
  }

  drawBlindsRect(gfx, rect, width, spacing, rotate, color) {
    if (!(rect.w > 0) || !(rect.h > 0)) return;
    const ctx = gfx.ctx;
    gfx.pushClip(rect.x, rect.y, rect.w, rect.h);

    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    gfx.startRotate(centerX, centerY, rotate);

    const diagonal = Math.sqrt(rect.w * rect.w + rect.h * rect.h);
    const startOffset = (diagonal - rect.w) / 2;
    let currentX = rect.x - startOffset;
    const endX = rect.x + rect.w + startOffset;

    ctx.fillStyle = `rgba(${(color >>> 16) & 0xff},${(color >>> 8) & 0xff},${color & 0xff},${
      ((color >>> 24) & 0xff) / 255
    })`;
    while (currentX < endX) {
      ctx.fillRect(
        currentX,
        rect.y - (diagonal - rect.h) / 2,
        width,
        rect.h + (diagonal - rect.h)
      );
      currentX += width + spacing;
    }

    gfx.stopRotate();
    gfx.popClip();
  }
}
