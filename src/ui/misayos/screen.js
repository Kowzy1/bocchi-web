// Port of me.baier.client.ui.mainmenu.misayos.MainMenuMisayosScreen.
//
// The component map in the Java source is a HashMap keyed 0..5, so the intro
// chain and the render order both follow the bucket order below.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { clamp, mlerp } from '../../engine/color.js';
import { MainMenuMisayosFrameContext } from '../../engine/frame.js';
import { BgRectsComponent } from './bgRects.js';
import { StrokeElementsComponent } from './strokeElements.js';
import { TextElementsComponent } from './textElements.js';
import { MainTachieComponent } from './mainTachie.js';
import { LogoComponent } from './logo.js';
import { GuiComponent } from './guiComponent.js';

export class MainMenuMisayosScreen {
  constructor() {
    this.bgRects = new BgRectsComponent();
    this.strokeElements = new StrokeElementsComponent();
    this.textElements = new TextElementsComponent();
    this.mainTachie = new MainTachieComponent();
    this.logo = new LogoComponent();
    this.gui = new GuiComponent();

    this.components = [
      this.bgRects,
      this.strokeElements,
      this.textElements,
      this.mainTachie,
      this.logo,
      this.gui,
    ];

    this.alphaAnimation = null;
    this.onBeginFadeIn();
  }

  onBeginFadeIn() {
    const frame = new MainMenuMisayosFrameContext();
    this.alphaAnimation = BezierAnimation.createFloat(0, 255, 1500, CP.EASE_IN_OUT);
    let lastAnimation = this.alphaAnimation;
    for (const component of this.components) {
      lastAnimation = component.initAnimations(frame, lastAnimation);
    }
    this.alphaAnimation.set(this.alphaAnimation.targetValue);
  }

  render(gfx, mouseX, mouseY) {
    const frame = new MainMenuMisayosFrameContext();
    const width = frame.scaledWidth;
    const height = frame.scaledHeight;

    this.gui.handleMouseMove(mouseX, mouseY);

    this.alphaAnimation.update();
    for (const component of this.components) component.update(frame);

    const globalAlpha = Math.round(clamp(this.alphaAnimation.currentValue, 0, 255));
    const expand = this.gui.expandAnimation.currentValue;

    gfx.pushLayer({ x: 0, y: 0, w: width, h: height }, { alpha: globalAlpha });
    gfx.pushLayer({ x: 0, y: 0, w: width, h: height }, { blurSigma: mlerp(expand, 0.01, 1) });

    gfx.save();
    gfx.translate(width / 2, height / 2);
    gfx.scaleBy(1 + expand / 20, 1 + expand / 20);
    gfx.translate(-width / 2, -height / 2);
    for (const component of this.components) component.render(gfx, frame);
    gfx.restore();

    gfx.popLayer();
    gfx.popLayer();
  }
}
