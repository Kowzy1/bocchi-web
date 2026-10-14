// Port of me.baier.client.ui.mainmenu.misayos.MainTachieComponent.

import { BezierAnimation, BezierControlPoints, CP } from '../../engine/bezier.js';
import { Assets, dilatedTintedSprite } from '../../engine/assets.js';
import { mlerp, replaceAlpha } from '../../engine/color.js';
import { renderAlbum } from '../common/album.js';
import { BaseComponent } from './base.js';

/** Port of me.baier.utils.ScreenUtils.calculateStartPosition */
export function calculateStartPosition(finalX, finalY, elWidth, elHeight, screenW, screenH, offset) {
  let startX = finalX;
  let startY = finalY;
  const distToLeft = finalX;
  const distToRight = screenW - (finalX + elWidth);
  const distToTop = finalY;
  const distToBottom = screenH - (finalY + elHeight);
  let minDist = distToLeft;
  let nearestEdge = 0;
  if (distToRight < minDist) {
    minDist = distToRight;
    nearestEdge = 1;
  }
  if (distToTop < minDist) {
    minDist = distToTop;
    nearestEdge = 2;
  }
  if (distToBottom < minDist) {
    nearestEdge = 3;
  }
  switch (nearestEdge) {
    case 0:
      startX = -elWidth - offset;
      break;
    case 1:
      startX = screenW + offset;
      break;
    case 2:
      startY = -elHeight - offset;
      break;
    case 3:
      startY = screenH + offset;
      break;
    default:
      break;
  }
  return { x: startX, y: startY };
}

import { BreathingUtil } from '../common/breathing.js';

export class MainTachieComponent extends BaseComponent {
  constructor() {
    super();
    this.breathing = new BreathingUtil(3000, -3, 0);
  }

  initAnimations(frame, lastAnimation) {
    this.albumAnim = BezierAnimation.createFloat(0, 1, 500, CP.CIRC_OUT);
    this.albumAlphaAnim = BezierAnimation.createFloat(
      0,
      1,
      500,
      new BezierControlPoints(0.83, 0.02, 0.98, 0.8)
    );
    this.mainGotohImageAlphaAnim = BezierAnimation.createFloat(
      0,
      1,
      500,
      new BezierControlPoints(0.83, 0.02, 0.98, 0.8)
    );
    this.mainGotohImageAnim = BezierAnimation.createFloat(0, 1, 800, CP.CUBIC_OUT);
    lastAnimation.then(this.mainGotohImageAnim, 0.1);
    lastAnimation.then(this.mainGotohImageAlphaAnim, 0.1);
    this.mainGotohImageAnim.then(this.albumAnim, 0.05);
    this.mainGotohImageAnim.then(this.albumAlphaAnim, 0.05);
    this.animations.push(this.mainGotohImageAnim);
    this.animations.push(this.albumAnim);
    this.animations.push(this.albumAlphaAnim);
    this.animations.push(this.mainGotohImageAlphaAnim);
    return this.mainGotohImageAnim;
  }

  render(gfx, frame) {
    if (this.mainGotohImageAnim === null) return;

    const screenWidth = frame.scaledWidth;
    const screenHeight = frame.scaledHeight;
    const block3Pos = frame.block3Pos;
    const block3Size = frame.block3Size;
    const ctx = gfx.ctx;

    const mainImageFinalHeight = screenHeight * 0.95;
    const mainImageFinalWidth = mainImageFinalHeight * 1.035483870967742;
    const mainImageFinalX = block3Pos.x + block3Size * 0.1;
    let mainImageFinalY = screenHeight * 0.05;
    if (mainImageFinalHeight <= screenHeight) mainImageFinalY = screenHeight - mainImageFinalHeight;

    const gotohImgStartPos = calculateStartPosition(
      mainImageFinalX,
      mainImageFinalY,
      mainImageFinalWidth,
      mainImageFinalHeight,
      screenWidth,
      screenHeight,
      50
    );

    const imageValue = this.mainGotohImageAnim.currentValue;
    const currentImageX = mlerp(imageValue, gotohImgStartPos.x, mainImageFinalX);
    const currentImageY = mlerp(imageValue, gotohImgStartPos.y, mainImageFinalY);
    const currentImageAlpha = Math.max(
      0,
      Math.min(1, this.mainGotohImageAlphaAnim.currentValue)
    );

    const rect3 = {
      x: block3Pos.x,
      y: block3Pos.y,
      w: block3Size,
      h: block3Size,
    };
    const recordRect = {
      x: screenWidth * 0.6,
      y: screenHeight * 0.18,
      w: screenHeight * 0.65,
      h: screenHeight * 0.65,
    };

    const albumStartPos = calculateStartPosition(
      recordRect.x,
      recordRect.y,
      recordRect.w,
      recordRect.h,
      screenWidth,
      screenHeight,
      50
    );
    const currentAlbumX = mlerp(this.albumAnim.currentValue, albumStartPos.x, recordRect.x);
    const currentAlbumY = mlerp(this.albumAnim.currentValue, albumStartPos.y, recordRect.y);
    const currentAlbumAlpha = Math.round(mlerp(this.albumAlphaAnim.currentValue, 0, 255));
    const albumRect = {
      x: currentAlbumX + 5,
      y: currentAlbumY + 5,
      w: recordRect.w - 10,
      h: recordRect.h - 10,
    };

    gfx.pushLayer(recordRect, { alpha: currentAlbumAlpha });
    renderAlbum(gfx, albumRect);
    gfx.popLayer();

    // Dark silhouette clipped to the artwork block.
    const dark = dilatedTintedSprite(
      Assets.bocchi,
      mainImageFinalWidth,
      mainImageFinalHeight,
      0x40000000,
      gfx.scale
    );
    gfx.pushClip(rect3.x, rect3.y, rect3.w, rect3.h);
    gfx.drawImage(
      dark.canvas,
      currentImageX - 15 - dark.pad,
      currentImageY - dark.pad,
      mainImageFinalWidth + dark.pad * 2,
      mainImageFinalHeight + dark.pad * 2,
      currentImageAlpha
    );
    gfx.popClip();

    gfx.save();
    const breathing = this.breathing.getCurrentValue();
    gfx.startRotate(
      currentImageX + mainImageFinalWidth * 0.38,
      currentImageY + mainImageFinalHeight + breathing,
      -(breathing + 1.5) / 3
    );

    const white = dilatedTintedSprite(
      Assets.bocchi,
      mainImageFinalWidth,
      mainImageFinalHeight,
      0xffffffff,
      gfx.scale
    );
    gfx.drawImage(
      white.canvas,
      currentImageX - white.pad,
      currentImageY - white.pad,
      mainImageFinalWidth + white.pad * 2,
      mainImageFinalHeight + white.pad * 2,
      currentImageAlpha
    );
    gfx.drawImage(
      Assets.bocchi,
      currentImageX,
      currentImageY,
      mainImageFinalWidth,
      mainImageFinalHeight,
      currentImageAlpha
    );
    gfx.stopRotate();

    // Squares travelling along a quadratic curve next to the character.
    const squareSize = 9;
    const p0 = {
      x: currentImageX + mainImageFinalWidth * 0.45,
      y: currentImageY + mainImageFinalHeight * 0.85,
    };
    const p1 = {
      x: currentImageX + mainImageFinalWidth * 0.55,
      y: currentImageY + mainImageFinalHeight * 0.55,
    };
    const p2 = {
      x: currentImageX + mainImageFinalWidth * 0.8,
      y: currentImageY + mainImageFinalHeight * 0.8,
    };

    const numCopies = 9;
    const currentNumCopies = Math.round(mlerp(imageValue, 3, numCopies));
    drawShapeAlongCurve(gfx, squareSize, currentNumCopies, p0, p1, p2, -30, 1.0, 0.01, 1.0, 0.1);

    gfx.restore();
  }
}

/** Port of me.baier.graphics.effects.SkijaEffects.drawShapeAlongCurve */
function drawShapeAlongCurve(
  gfx,
  squareSize,
  numCopies,
  p0,
  p1,
  p2,
  initialRotationDeg,
  startScale,
  endScale,
  startOpacity,
  endOpacity
) {
  if (numCopies <= 0) return;
  const ctx = gfx.ctx;
  for (let i = 0; i < numCopies; i++) {
    const t = numCopies === 1 ? 0 : i / (numCopies - 1);
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    const currentScale = mlerp(t, startScale, endScale);
    const opacity = mlerp(t, startOpacity, endOpacity);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((initialRotationDeg * Math.PI) / 180);
    ctx.scale(currentScale, currentScale);
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    ctx.fillRect(-squareSize / 2, -squareSize / 2, squareSize, squareSize);
    ctx.restore();
  }
}
