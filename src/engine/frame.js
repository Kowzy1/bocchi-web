// Port of me.baier.client.ui.model.FrameContext and its subclasses.

export const viewport = {
  scaledWidth: 0,
  scaledHeight: 0,
};

export class FrameContext {
  constructor() {
    this.scaledWidth = viewport.scaledWidth;
    this.scaledHeight = viewport.scaledHeight;
  }
}

export class MainMenuMisayosFrameContext extends FrameContext {
  constructor() {
    super();
    const w = this.scaledWidth;
    const h = this.scaledHeight;
    this.block1Pos = { x: w * 0.095, y: h * 0.4 };
    this.block1Size = Math.min(w * 0.2265625, h * 0.4027777777777778);
    this.block3Pos = { x: w * 0.263125, y: h * 0.0972222222222222 };
    this.block3Size = Math.min(w * 0.4166666666666667, h * 0.7407407407407407);
  }
}

export class SplashFrameContext extends FrameContext {
  constructor() {
    super();
    const w = this.scaledWidth;
    const h = this.scaledHeight;
    this.midX = Math.trunc(w / 2);
    this.midY = Math.trunc(h / 2);
    const d = Math.min(w * 0.75, h) * 0.25;
    this.spacing = Math.trunc(d * 0.5);
  }
}
