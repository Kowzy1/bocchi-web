// Port of me.baier.client.ui.common.components.LogoRenderer.
// The Java version renders the PNG through `ColorFilter.makeBlend(color, SRC_IN)`,
// i.e. the logo alpha filled with `color`.

import { Assets, tintedSprite } from '../../engine/assets.js';

export function renderLogoWithColor(gfx, x, y, w, h, color) {
  if (!Assets.logo) return;
  const sprite = tintedSprite(Assets.logo, w, h, color, gfx.scale);
  gfx.drawSprite(sprite, x, y, w, h);
}
