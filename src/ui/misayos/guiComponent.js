// Port of me.baier.client.ui.mainmenu.misayos.GuiComponent and its children
// (ButtonChild / IconButtonChild / ExpandArrowChild), plus the slice of
// me.baier.skui.SkComponent that drives their hover state.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { Assets, tintedSprite } from '../../engine/assets.js';
import { lerpColor, mlerp, replaceAlpha, cssColor } from '../../engine/color.js';
import { FontSet } from '../../engine/font.js';
import { drawTextStrokeBox } from '../common/renderUtils.js';
import { BaseComponent } from './base.js';

/** Skia RRect containment, used by ButtonChild#isHovered. */
function rrectContains(x, y, w, h, radius, px, py) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const r = Math.min(radius, Math.min(w, h) / 2);
  const cx = px < x + r ? x + r : px > x + w - r ? x + w - r : px;
  const cy = py < y + r ? y + r : py > y + h - r ? y + h - r : py;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function triangleContains(ax, ay, bx, by, cx, cy, px, py) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

class ButtonChild {
  constructor(icon, display) {
    this.x = 0;
    this.y = 0;
    this.width = 100;
    this.height = 100;
    this.icon = Assets.icons[icon];
    this.display = display;
    this.hovered = false;
    this.hoverAnimation = BezierAnimation.createFloat(0, 1, 300, CP.CUBIC_OUT);
  }

  absoluteX() {
    return this.parent ? this.parent.absoluteX() + this.x : this.x;
  }

  absoluteY() {
    return this.parent ? this.parent.absoluteY() + this.y : this.y;
  }

  buttonRadius() {
    return mlerp(this.hoverAnimation.currentValue, 3.5, 5.5);
  }

  isHoveredAt(mx, my) {
    return rrectContains(
      this.absoluteX(),
      this.absoluteY(),
      this.width,
      this.height,
      this.buttonRadius(),
      mx,
      my
    );
  }

  isChildHovered() {
    return false;
  }

  handleMouseMove(mx, my) {
    this.mouseX = mx;
    this.mouseY = my;
  }

  render(gfx, mouseX, mouseY) {
    const hovered = this.isHoveredAt(mouseX, mouseY);
    if (hovered) {
      if (!this.hovered) {
        this.hovered = true;
        this.hoverAnimation = BezierAnimation.createFloat(0, 1, 300, CP.CUBIC_OUT);
        this.hoverAnimation.start();
      }
    } else if (this.hovered) {
      this.hovered = false;
      this.hoverAnimation = BezierAnimation.createFloat(1, 0, 600, CP.CUBIC_OUT);
      this.hoverAnimation.start();
    }
    this.hoverAnimation.update();

    const hover = this.hoverAnimation.currentValue;
    const absX = this.absoluteX();
    const absY = this.absoluteY();

    gfx.drawRoundRect(
      absX,
      absY,
      this.width,
      this.height,
      this.buttonRadius(),
      lerpColor(0xff353535, 0xfffba0be, hover)
    );

    const iconX = this.display !== null ? absX + this.width / 6 : absX + this.width / 2;
    const iconY = absY + this.height / 2;
    const circleHeight = this.height / 3;
    const iconHeight = circleHeight + mlerp(hover, 0, 2);

    gfx.drawCircle(iconX, iconY, circleHeight, lerpColor(0xff5b5b5b, 0xffffffff, hover));

    if (this.icon) {
      const sprite = tintedSprite(
        this.icon,
        iconHeight,
        iconHeight,
        lerpColor(0xffd4d4d4, 0xfffba0be, hover),
        gfx.scale
      );
      gfx.drawSprite(sprite, iconX - iconHeight / 2, iconY - iconHeight / 2, iconHeight, iconHeight);
    }

    if (this.display !== null) {
      const buttonFont = FontSet.SH_BOLD.getFont(mlerp(hover, 9.5, 10.5));
      const displayWidth = buttonFont.getStringWidth(this.display);
      buttonFont.drawString(
        gfx,
        this.display,
        absX + this.width / 2 - displayWidth / 2 + 3.5,
        iconY - buttonFont.getHalfHeight(),
        0xffffffff
      );
    }
  }
}

class IconButtonChild extends ButtonChild {
  constructor(icon) {
    super(icon, null);
  }
}

class ExpandArrowChild {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 100;
    this.height = 100;
    this.parent = null;
  }

  absoluteX() {
    return this.parent ? this.parent.absoluteX() + this.x : this.x;
  }

  absoluteY() {
    return this.parent ? this.parent.absoluteY() + this.y : this.y;
  }

  arrowPoints() {
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    const parentHeight = this.parent ? this.parent.height : 0;
    const tipOffset = 10;
    const halfWidth = 5;
    const heightRatio = 0.06;
    return {
      ax,
      ay,
      a: { x: ax - tipOffset, y: ay },
      b: { x: ax + halfWidth, y: ay + parentHeight * heightRatio },
      c: { x: ax + halfWidth, y: ay - parentHeight * heightRatio },
    };
  }

  isHoveredAt(mx, my) {
    const p = this.arrowPoints();
    return triangleContains(p.a.x, p.a.y, p.b.x, p.b.y, p.c.x, p.c.y, mx, my);
  }

  isChildHovered() {
    return false;
  }

  handleMouseMove() {}

  render(gfx) {
    const p = this.arrowPoints();
    const ctx = gfx.ctx;
    ctx.save();
    ctx.fillStyle = cssColor(0xffffffff);
    ctx.beginPath();
    ctx.moveTo(p.a.x, p.a.y);
    ctx.lineTo(p.b.x, p.b.y);
    ctx.lineTo(p.c.x, p.c.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    gfx.drawCircle(p.ax + 1.5, p.ay, 3, 0xffebebeb);
  }
}

export class GuiComponent extends BaseComponent {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.width = 100;
    this.height = 100;
    this.parent = null;
    this.hovered = false;
    this.childHovered = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.expandState = false;
    // Screenshot aid only: forces the panel open without a real mouse.
    this.forceExpand = false;
    this.expandAnimation = BezierAnimation.createFloat(0, 1, 500, CP.CIRC_OUT);
    this.fadeInAnimation = null;

    this.expandChild = new ExpandArrowChild();
    this.buttons = [
      new ButtonChild('single', 'SinglePlayer'),
      new ButtonChild('multi', 'MultiPlayer'),
      new ButtonChild('alt', 'Alt Manager'),
      new ButtonChild('option', 'Options'),
    ];
    this.icons = [new IconButtonChild('lang'), new IconButtonChild('quit')];
    this.children = [this.expandChild, ...this.buttons, ...this.icons];
    for (const child of this.children) child.parent = this;
  }

  absoluteX() {
    return this.parent ? this.parent.absoluteX() + this.x : this.x;
  }

  absoluteY() {
    return this.parent ? this.parent.absoluteY() + this.y : this.y;
  }

  initAnimations(frame, lastAnimation) {
    this.fadeInAnimation = BezierAnimation.createFloat(0, 1, 800, CP.CUBIC_OUT);
    lastAnimation.then(this.fadeInAnimation, 0.05);
    return this.fadeInAnimation;
  }

  applyLayout() {
    const buttonYOffsetStart = 10;
    const buttonWidth = 75;
    let offset = buttonYOffsetStart;
    for (const button of this.buttons) {
      button.x = 5 + (this.width - 5 - buttonWidth) / 2;
      button.y = 30 + offset;
      button.width = buttonWidth;
      button.height = 15;
      offset += 20.5;
    }
    const lastButton = this.buttons[this.buttons.length - 1];
    const dOffsetX = 0;
    lastButton.x += dOffsetX;
    let iconXOffset = 1;
    const spacing = 1;
    lastButton.width =
      buttonWidth - dOffsetX * this.icons.length - iconXOffset - 15 * this.icons.length - spacing;
    for (const icon of this.icons) {
      icon.x = lastButton.x + lastButton.width + iconXOffset;
      icon.y = lastButton.y;
      icon.height = 15;
      icon.width = 15;
      iconXOffset += icon.width + spacing;
    }
  }

  handleMouseMove(mouseX, mouseY) {
    this.mouseX = mouseX;
    this.mouseY = mouseY;
    let childHovered = false;
    for (const child of this.children) {
      child.handleMouseMove(mouseX, mouseY);
      if (child.isHoveredAt(mouseX, mouseY) || child.isChildHovered()) childHovered = true;
    }
    this.childHovered = childHovered;
    this.hovered =
      !childHovered &&
      mouseX >= this.absoluteX() &&
      mouseX <= this.absoluteX() + this.width &&
      mouseY >= this.absoluteY() &&
      mouseY <= this.absoluteY() + this.height;
  }

  update(frame) {
    this.expandAnimation.update();
    if (this.fadeInAnimation) this.fadeInAnimation.update();

    const lerp = this.expandAnimation.currentValue;
    this.height = frame.block3Size * 0.85;
    this.width = 95;
    const fade = this.fadeInAnimation ? this.fadeInAnimation.currentValue : 0;
    this.x = mlerp(
      fade,
      frame.scaledWidth + 10,
      mlerp(lerp, frame.scaledWidth - this.width / 10, frame.scaledWidth - this.width)
    );
    this.y = (frame.scaledHeight - this.height) / 2;
    this.expandChild.y = this.height / 2;
    this.applyLayout();

    const isValidMousePos = this.mouseX !== 0 || this.mouseY !== 0;
    if (this.forceExpand || this.hovered || (this.childHovered && isValidMousePos)) {
      if (!this.expandState) {
        this.expandState = true;
        this.expandAnimation = BezierAnimation.createFloat(0, 1, 300, CP.CUBIC_OUT);
        this.expandAnimation.start();
      }
    } else if (this.expandState) {
      this.expandState = false;
      this.expandAnimation = BezierAnimation.createFloat(1, 0, 600, CP.CUBIC_OUT);
      this.expandAnimation.start();
    }
  }

  /** The full screen dim, drawn inside the blurred layer. */
  render(gfx, frame) {
    gfx.drawRect(
      0,
      0,
      frame.scaledWidth,
      frame.scaledHeight,
      replaceAlpha(0xff000000, Math.round(mlerp(this.expandAnimation.currentValue, 0, 125)))
    );
  }

  /** SkComponent.onRender + onRenderChildren, drawn above the blur layer. */
  renderPanel(gfx, mouseX, mouseY) {
    const ctx = gfx.ctx;
    const absX = this.absoluteX();
    const absY = this.absoluteY();
    const borderWidth = 5;

    gfx.drawRect(absX, absY, borderWidth, this.height, 0xffffffff);
    gfx.drawRect(absX + borderWidth, absY, this.width - borderWidth, this.height, 0xfff5f5f5);

    const titleFont = FontSet.SH_HEAVY.getFont(21);
    const bocchiWidth = titleFont.getStringWidth('BOCCHI', -0.1);
    const titlePosX = absX + bocchiWidth / 2;
    const titlePosY = absY + titleFont.getHeight() + 3;

    titleFont.drawString(gfx, 'BOCCHI', titlePosX, titlePosY, 0xff353535, -0.1);
    gfx.drawLine(
      titlePosX - 2.5,
      titlePosY + titleFont.getHeight() + 2.5,
      titlePosX + bocchiWidth + 2.5,
      titlePosY + titleFont.getHeight() + 2.5,
      0x66353535,
      0.2
    );

    const versionFont = FontSet.SH_REGULAR.getFont(10);
    drawTextStrokeBox(
      gfx,
      versionFont,
      '1.0',
      titlePosX + bocchiWidth + 5,
      titlePosY + titleFont.getHalfHeight() / 2 + versionFont.getHalfHeight() / 2,
      0xff353535,
      0xff353535,
      0,
      2,
      1.2,
      3,
      0.5
    );

    const branchFont = FontSet.SH_HEAVY.getFont(11);
    const branchTextPosX = titlePosX;
    const branchTextPosY = titlePosY + titleFont.getHeight() + branchFont.getHalfHeight() / 2 + 1 + 3;
    branchFont.drawString(gfx, '"ALPHA"', branchTextPosX, branchTextPosY, 0xff353535, -0.1);

    const lineY = absY + this.height * 0.85;
    gfx.drawLine(absX + borderWidth + 3, lineY, absX + this.width - 3, lineY, 0x66353535, 0.2);

    const copyRightFont = FontSet.SH_NORMAL.getFont(7);
    const branchVersionWidth = copyRightFont.getStringWidth('Bocchi Client    Version - 1.0');
    copyRightFont.drawString(
      gfx,
      'Bocchi Client    Version - 1.0',
      absX + 5 + (this.width - 5 - branchVersionWidth) / 2,
      absY + this.height - copyRightFont.getHeight() * 3 - 5,
      0xff353535
    );
    const copyRightWidth = copyRightFont.getStringWidth('@COPYRIGHT MISAYO');
    copyRightFont.drawString(
      gfx,
      '@COPYRIGHT MISAYO',
      absX + 5 + (this.width - 5 - copyRightWidth) / 2,
      absY + this.height - copyRightFont.getHeight() * 2 - 2.5,
      0xff353535
    );

    this.expandChild.render(gfx, mouseX, mouseY);
    for (const button of this.buttons) button.render(gfx, mouseX, mouseY);
    for (const icon of this.icons) icon.render(gfx, mouseX, mouseY);

    void ctx;
  }
}
