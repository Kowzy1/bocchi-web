// Port of me.baier.client.ui.mainmenu.component.api.AbstractBaseComponent.

export class BaseComponent {
  constructor() {
    this.animations = [];
  }

  update() {
    for (const animation of this.animations) {
      if (animation.isAnimating && !animation.isPaused) animation.update();
    }
  }
}
