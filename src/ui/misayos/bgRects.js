// Port of me.baier.client.ui.mainmenu.misayos.BgRectsComponent.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { Assets } from '../../engine/assets.js';
import { cssColor, mlerp, replaceAlpha } from '../../engine/color.js';
import { BaseComponent } from './base.js';

export class BgRectsComponent extends BaseComponent {
  initAnimations(frame, lastAnimation) {
    this.smallerRectAnim = BezierAnimation.createFloat(0, 1, 1000, CP.CUBIC_OUT);
    this.biggerRectAnim = BezierAnimation.createFloat(0, 1, 1000, CP.CUBIC_OUT);
    lastAnimation.then(this.smallerRectAnim, 0.4);
    this.smallerRectAnim.then(this.biggerRectAnim, 0.1);
    this.animations = [this.smallerRectAnim, this.biggerRectAnim];
    return this.biggerRectAnim;
  }

  render(gfx, frame) {
    const screenWidth = frame.scaledWidth;
    const screenHeight = frame.scaledHeight;
    const ctx = gfx.ctx;
    const group1Alpha = Math.round(mlerp(this.smallerRectAnim.currentValue, 0, 255));

    const background = ctx.createLinearGradient(screenWidth / 2, 0, screenWidth / 2, screenHeight);
    background.addColorStop(0, cssColor(replaceAlpha(0xff07021c, group1Alpha)));
    background.addColorStop(1, cssColor(replaceAlpha(0xff492f49, group1Alpha)));
    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, screenWidth, screenHeight);
    ctx.restore();

    const block1Pos = frame.block1Pos;
    const block1Size = frame.block1Size;
    const currentBlock1Size = mlerp(this.smallerRectAnim.currentValue, 0, block1Size);
    gfx.drawRect(
      block1Pos.x,
      block1Pos.y,
      block1Size,
      currentBlock1Size,
      replaceAlpha(0xfffc67a7, group1Alpha)
    );
    gfx.drawRectLTRB(
      block1Pos.x,
      Math.max(0, block1Size - currentBlock1Size - 1),
      block1Pos.x + block1Size,
      block1Pos.y,
      replaceAlpha(0xfffb85ae, group1Alpha)
    );

    const group2Alpha = Math.round(mlerp(this.biggerRectAnim.currentValue, 0, 255));
    const block3Pos = frame.block3Pos;
    const block3Size = frame.block3Size;
    const currentBlock3Size = mlerp(this.biggerRectAnim.currentValue, 0, block3Size);
    const block3Rect = {
      x: block3Pos.x,
      y: block3Pos.y,
      w: block3Size,
      h: currentBlock3Size,
    };

    const artGradient = ctx.createLinearGradient(
      block3Rect.x + block3Size - block3Size / 2,
      block3Rect.y,
      block3Rect.x,
      block3Rect.y + block1Size / 2
    );
    artGradient.addColorStop(0, cssColor(replaceAlpha(0xfff69db2, group2Alpha)));
    artGradient.addColorStop(1, cssColor(replaceAlpha(0xffff78bb, group2Alpha)));

    gfx.drawRectShadow(
      block3Rect.x,
      block3Rect.y,
      block3Rect.w,
      block3Rect.h,
      -15,
      0,
      30,
      replaceAlpha(0x55000000, Math.round(group2Alpha * 0.34))
    );

    gfx.pushClip(block3Rect.x, block3Rect.y, block3Rect.w, block3Rect.h);
    ctx.save();
    ctx.fillStyle = artGradient;
    ctx.fillRect(block3Rect.x, block3Rect.y, block3Rect.w, block3Rect.h);
    ctx.restore();

    gfx.drawImageRect(
      Assets.bocchi,
      406,
      600,
      700,
      700,
      block3Pos.x,
      block3Pos.y,
      block3Size,
      block3Size,
      0.07
    );
    gfx.popClip();
  }
}
