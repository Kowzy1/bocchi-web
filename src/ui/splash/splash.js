// Port of me.baier.client.ui.splash.SplashUI + LoadingAnimateRenderer and the
// driver logic from MixinSplashOverlay (which owns the fade timings).

import { BezierAnimation, BezierControlPoints, CP } from '../../engine/bezier.js';
import { Assets } from '../../engine/assets.js';
import { clamp, lerpColor, mlerp, replaceAlpha } from '../../engine/color.js';
import { SplashFrameContext } from '../../engine/frame.js';
import { FontSet } from '../../engine/font.js';
import { now } from '../../engine/time.js';
import { renderLogoWithColor } from '../common/logoRenderer.js';
import { BreathingUtil } from '../common/breathing.js';

export const BRAND_ARGB = 0xff1f1f1f;

/** Port of me.baier.client.ui.splash.LoadingAnimateRenderer. */
class LoadingAnimateRenderer {
  constructor(texture, targetFPS) {
    this.texture = texture;
    this.totalFrames = 20;
    this.frameInterval = Math.trunc(1000 / targetFPS);
    this.currentFrame = 0;
    this.lastFrameTime = now();
  }

  computeFrame() {
    const currentTime = now();
    const elapsed = currentTime - this.lastFrameTime;
    if (elapsed >= this.frameInterval) {
      const steps = Math.floor(elapsed / this.frameInterval);
      this.currentFrame = (this.currentFrame + steps) % this.totalFrames;
      this.lastFrameTime = currentTime;
    }
  }

  render(gfx, x, y, w, h, alpha) {
    gfx.drawImageRect(this.texture, this.currentFrame * 90, 0, 90, 90, x, y, w, h, alpha);
  }
}

export class SplashUI {
  constructor() {
    this.fontHeight = 9.4;
    this.frame = new SplashFrameContext();
    this.animateRenderer = new LoadingAnimateRenderer(Assets.loading, 20);

    this.globalAlphaAnim = null;
    this.progressAnim = null;
    this.logoAnimation = null;
    this.breathingTextAlpha = null;
    this.waitingForInput = false;

    this.iLogoW = 94;
    this.iLogoH = this.iLogoW * 0.317;
    this.iLogoX = this.frame.midX - this.iLogoW / 2;
    this.iLogoY = this.frame.midY - this.fontHeight - this.frame.spacing;
    this.iLogoC = 0xffffffff;

    this.tLogoX = 0;
    this.tLogoY = 0;
    this.tLogoW = 0;
    this.tLogoH = 0;
    this.tLogoC = 0xffffffff;
  }

  onOKToFadeOut() {
    this.waitingForInput = true;
    this.progressAnim = BezierAnimation.createFloat(0, 1, 500, CP.CUBIC_OUT);
    this.progressAnim.start();
    this.breathingTextAlpha = new BreathingUtil(1000, 0.65, 1);
  }

  onBeginFadeOut() {
    this.globalAlphaAnim = BezierAnimation.createFloat(0, 250, 1000, CP.EASE_IN_OUT);
    this.globalAlphaAnim.set(255);

    const rect1Width = this.frame.scaledWidth * 0.412;
    const rect1PosX = (this.frame.scaledWidth - rect1Width) / 2;
    this.tLogoX = rect1PosX * 0.3;
    this.tLogoY = this.frame.scaledHeight * 0.1;
    this.tLogoW = 60;
    this.tLogoH = this.tLogoW * 0.317;
    this.tLogoC = 0xffffffff;
  }

  isEnded() {
    return this.globalAlphaAnim !== null && this.globalAlphaAnim.isComplete();
  }

  isOkToFadeOut() {
    return this.globalAlphaAnim === null && !this.waitingForInput;
  }

  /** SplashUI#render -- opens the brand-coloured layer. */
  render(gfx) {
    this.frame = new SplashFrameContext();
    const width = this.frame.scaledWidth;
    const height = this.frame.scaledHeight;

    if (this.globalAlphaAnim !== null) {
      this.globalAlphaAnim.update();
      if (this.globalAlphaAnim.progress >= 0.1 && this.logoAnimation === null) {
        this.logoAnimation = BezierAnimation.createFloat(
          0,
          1,
          1000,
          new BezierControlPoints(0.9, 0, 0.1, 1)
        );
        this.logoAnimation.set(1);
      }
      const alpha = Math.round(clamp(255 - this.globalAlphaAnim.currentValue, 0, 255));
      gfx.pushLayer({ x: 0, y: 0, w: width, h: height }, { alpha });
    }

    // canvas.clear(BRAND_ARGB) -- an opaque fill in SRC mode.
    gfx.drawRect(0, 0, width, height, BRAND_ARGB);
  }

  /** SplashUI#renderProgress -- closes the layer opened by render(). */
  renderProgress(gfx, progress, f) {
    if (this.progressAnim !== null) this.progressAnim.update();

    const alpha = Math.round(clamp(f, 0, 3) * 85);
    const argb = replaceAlpha(0xffffffff, alpha);
    const posX = this.frame.scaledWidth * 0.2;
    const posY = this.frame.midY + this.frame.spacing + this.fontHeight / 2;
    const width = this.frame.scaledWidth * 0.6 * progress;
    const spinnerX = posX + width - this.fontHeight * 1.5;
    const spinnerY = posY - this.fontHeight * 1.5;
    const spinnerSize = this.fontHeight * 2.5;

    gfx.pushLayer(null, {
      alpha: Math.round(255 - (this.progressAnim !== null ? this.progressAnim.currentValue : 0) * 255),
    });

    this.animateRenderer.computeFrame();

    // saveLayer(rrect) -> draw the bar -> punch the spinner out with DST_OUT.
    gfx.pushLayer({ x: posX, y: posY, w: width, h: this.fontHeight }, {});
    gfx.drawRoundRect(posX, posY, width, this.fontHeight, 15, argb);
    const layerCtx = gfx.ctx;
    layerCtx.globalCompositeOperation = 'destination-out';
    this.animateRenderer.render(gfx, spinnerX, spinnerY, spinnerSize, spinnerSize, 1);
    layerCtx.globalCompositeOperation = 'source-over';
    gfx.popLayer();

    // ... then draw the spinner again on top of the punched-out bar.
    this.animateRenderer.render(gfx, spinnerX, spinnerY, spinnerSize, spinnerSize, alpha / 255);

    gfx.popLayer();

    if (this.progressAnim !== null) {
      const fontRenderer = FontSet.RADIKAL_REGULAR.getFont(15);
      const stringWidth = fontRenderer.getStringWidth('TAP TO START');
      const midX = this.frame.midX - stringWidth / 2;
      const textAlpha = this.progressAnim.currentValue * 255;
      const color = replaceAlpha(
        0xffffffff,
        Math.round(mlerp(this.breathingTextAlpha.getCurrentValue(), 0, textAlpha))
      );
      gfx.withSolidBlur(5, (proxy) => {
        fontRenderer.drawString(
          proxy,
          'TAP TO START',
          midX,
          posY + fontRenderer.getHalfHeight() / 2,
          color
        );
      });
    }

    if (this.globalAlphaAnim !== null) gfx.popLayer();

    if (this.logoAnimation !== null) {
      this.logoAnimation.update();
      const t = this.logoAnimation.currentValue;
      renderLogoWithColor(
        gfx,
        mlerp(t, this.iLogoX, this.tLogoX),
        mlerp(t, this.iLogoY, this.tLogoY),
        mlerp(t, this.iLogoW, this.tLogoW),
        mlerp(t, this.iLogoH, this.tLogoH),
        mlerpColorInt(this.iLogoC, this.tLogoC, t)
      );
    } else {
      renderLogoWithColor(gfx, this.iLogoX, this.iLogoY, this.iLogoW, this.iLogoH, this.iLogoC);
    }
  }
}

function mlerpColorInt(from, to, t) {
  return lerpColor(from, to, t);
}
