// Port of me.baier.client.ui.mainmenu.common.LogoComponent -- shared by the
// splash screen and the main menu. The logo only appears once the component has
// been alive for a second.

import { now } from '../../engine/time.js';
import { BaseComponent } from './base.js';
import { renderLogoWithColor } from '../common/logoRenderer.js';

export class LogoComponent extends BaseComponent {
  constructor() {
    super();
    this.lastMS = now();
  }

  initAnimations(frame, lastAnimation) {
    this.lastMS = now();
    return lastAnimation;
  }

  render(gfx, frame) {
    if (now() - this.lastMS <= 1000) return;

    const scaledWidth = frame.scaledWidth;
    const rect1Width = scaledWidth * 0.412;
    const rect1PosX = (scaledWidth - rect1Width) / 2;
    const logoDrawPosX = rect1PosX * 0.3;
    const logoDrawPosY = frame.scaledHeight * 0.1;
    const logoCurrentWidth = 60;
    const logoCurrentHeight = logoCurrentWidth * 0.317;

    renderLogoWithColor(gfx, logoDrawPosX, logoDrawPosY, logoCurrentWidth, logoCurrentHeight, 0xffffffff);
  }
}
