// Port of me.baier.client.ui.mainmenu.misayos.GuiComponent and its children
// (ButtonChild / IconButtonChild / ExpandArrowChild), plus the slice of
// me.baier.skui.SkComponent that drives their hover state.
//
// The button column of the original menu is retargeted here as a login panel:
// the account / password form keeps the original visual language (fonts,
// palette, rounded shapes and hover animations) so it still reads as the same
// UI.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { Assets, tintedSprite } from '../../engine/assets.js';
import { lerpColor, mlerp, replaceAlpha, cssColor } from '../../engine/color.js';
import { FontSet } from '../../engine/font.js';
import { now } from '../../engine/time.js';
import { viewport } from '../../engine/frame.js';
import { BaseComponent } from './base.js';

/** Left inset and width of the form column inside the panel. */
const FORM_X = 10;
const FORM_WIDTH = 80;
/** Vertical offsets of the form rows, relative to the form's start. */
const FORM_LABEL_1 = 0;
const FORM_FIELD_1 = 6;
const FORM_LABEL_2 = 28;
const FORM_FIELD_2 = 34;
const FORM_REMEMBER = 56;
const FORM_LOGIN = 70;
const FORM_FIELD_HEIGHT = 16;
const FORM_REMEMBER_SIZE = 7;
/** Height of the form block, from the first label to the bottom of the button. */
const FORM_BLOCK_HEIGHT = FORM_LOGIN + FORM_FIELD_HEIGHT;
/** The "Login" title occupies the top of the card. */
const HEADER_BOTTOM = 27;
const FORM_TOP_GAP = 11;
const FORM_BOTTOM_MARGIN = 16;
/** The card hugs its content, so it keeps the same shape at every GUI scale. */
const PANEL_HEIGHT = HEADER_BOTTOM + FORM_TOP_GAP + FORM_BLOCK_HEIGHT + FORM_BOTTOM_MARGIN;
const PANEL_MIN_HEIGHT = 120;
/** Base card width; the whole card is drawn at `cardScale` times these units. */
const BASE_WIDTH = 95;
const MIN_CARD_SCALE = 0.6;

/** Demo credentials accepted by the login form. */
const DEMO_USER = 'admin';
const DEMO_PASSWORD = '123456';

/**
 * Signed-in "one-time password" view. Its own (wider) card so the content gets
 * the same breathing room as the login form; all values are in this card's units.
 */
const PROFILE = {
  width: 130,
  height: 200,
  avatarCy: 29,
  avatarR: 15,
  nameTop: 53,
  nameSize: 22,
  linksTop: 72,
  linkSize: 17,
  linkGap: 8,
  otpX: 13,
  otpRight: 117,
  otpTop: 90,
  otpBottom: 185,
  otpRadius: 5,
  otpTitleTop: 99,
  otpTitleSize: 21,
  clockCy: 124,
  clockR: 10,
  boxTop: 141,
  boxSize: 11,
  boxGap: 5,
  hintTop: 158,
  hintSize: 15,
  linkTop: 170,
};
const OTP_LENGTH = 6;

const COLOR_INK = 0xff2b2b2b;
const COLOR_PINK = 0xffe0397a;
const COLOR_BLUE = 0xff3b7bf6;
const COLOR_MUTED = 0xff8a8a8a;
const COLOR_HAIRLINE = 0xffd8d8d8;

/**
 * Responsive card scale. The card keeps a fixed shape in GUI units, but its
 * physical size is chosen per device class (phone / tablet / desktop) so it
 * reads well on a phone and is not lost on a large desktop window.
 */
function computeCardScale(isPhone, baseWidth = BASE_WIDTH, baseHeight = PANEL_HEIGHT) {
  const guiWidth = viewport.scaledWidth || 1;
  const guiHeight = viewport.scaledHeight || 1;
  const cssWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1024;
  const cssPerGui = cssWidth / guiWidth;
  let targetCss;
  if (isPhone) {
    targetCss = Math.min(cssWidth * 0.9, 360); // phone
  } else if (cssWidth < 1024) {
    targetCss = 340; // tablet
  } else {
    targetCss = 380; // desktop
  }
  // Never wider than the viewport (with a margin), nor taller than it.
  const maxByWidth = guiWidth - (isPhone ? 16 : 8);
  const maxByHeight = (guiHeight - 16) / (baseHeight / baseWidth);
  const widthGui = Math.min(targetCss / cssPerGui, maxByWidth, maxByHeight);
  return Math.max(MIN_CARD_SCALE, widthGui / baseWidth);
}

/** Scale factor a child inherits from the card that owns it. */
function childScale(child) {
  return child.parent ? child.parent.cardScale : 1;
}

/**
 * True on touch-only devices (tablets / phones), where `:hover` never fires and
 * the card has to be opened by a tap instead.
 */
function isTouchDevice() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (
    window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches
  );
}

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

/** Rounded rectangle outline, the stroke counterpart of Gfx#drawRoundRect. */
function strokeRoundRect(gfx, x, y, w, h, radius, color, lineWidth) {
  const ctx = gfx.ctx;
  const r = Math.min(radius, Math.min(w, h) / 2);
  ctx.save();
  ctx.strokeStyle = cssColor(color);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Simple eye glyph for the password reveal toggle. */
function drawEyeIcon(gfx, cx, cy, size, color, open) {
  const ctx = gfx.ctx;
  ctx.save();
  ctx.strokeStyle = cssColor(color);
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.quadraticCurveTo(cx, cy - size * 0.9, cx + size, cy);
  ctx.quadraticCurveTo(cx, cy + size * 0.9, cx - size, cy);
  ctx.stroke();
  if (open) {
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - size, cy + size * 0.55);
    ctx.lineTo(cx + size, cy - size * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

/** Circular silhouette avatar for the signed-in view. */
function drawAvatar(gfx, cx, cy, r) {
  const ctx = gfx.ctx;
  const lw = Math.max(0.6, r * 0.07);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - lw / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = cssColor(COLOR_INK);
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.22, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.72, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  gfx.drawCircleStroke(cx, cy, r - lw / 2, lw, COLOR_INK);
}

/** Pie / timer icon used by the one-time password card. */
function drawClock(gfx, cx, cy, r) {
  const ctx = gfx.ctx;
  const lw = Math.max(0.8, r * 0.16);
  const inner = r - lw / 2;
  ctx.save();
  ctx.fillStyle = cssColor(COLOR_INK);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, inner, Math.PI * 0.85, Math.PI * 1.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  gfx.drawCircleStroke(cx, cy, inner, lw, COLOR_INK);
}

function caretVisible() {
  return Math.floor(now() / 530) % 2 === 0;
}

class ButtonChild {
  constructor(icon, display) {
    this.x = 0;
    this.y = 0;
    this.width = 100;
    this.height = 100;
    this.icon = icon ? Assets.icons[icon] : null;
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
    return mlerp(this.hoverAnimation.currentValue, 3.5, 5.5) * childScale(this);
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
    const s = childScale(this);
    const hasIcon = !!this.icon;

    gfx.drawRoundRect(
      absX,
      absY,
      this.width,
      this.height,
      this.buttonRadius(),
      lerpColor(0xff353535, 0xfffba0be, hover)
    );

    const iconX = this.display !== null && hasIcon ? absX + this.width / 6 : absX + this.width / 2;
    const iconY = absY + this.height / 2;
    const circleHeight = this.height / 3;
    const iconHeight = circleHeight + mlerp(hover, 0, 2 * s);

    if (hasIcon) {
      gfx.drawCircle(iconX, iconY, circleHeight, lerpColor(0xff5b5b5b, 0xffffffff, hover));
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
      const buttonFont = FontSet.SH_BOLD.getFont(mlerp(hover, 9.5, 10.5) * s);
      const displayWidth = buttonFont.getStringWidth(this.display);
      buttonFont.drawString(
        gfx,
        this.display,
        absX + this.width / 2 - displayWidth / 2 + (hasIcon ? 3.5 * s : 0),
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

/**
 * Account / password input. Mirrors the flat panel language: a white rounded
 * box with a hairline border that turns pink while focused, a placeholder and a
 * blinking caret. Password fields get an eye toggle.
 */
class InputField {
  constructor(placeholder, isPassword = false) {
    this.x = 0;
    this.y = 0;
    this.width = FORM_WIDTH;
    this.height = 15;
    this.placeholder = placeholder;
    this.isPassword = isPassword;
    this.value = '';
    this.focused = false;
    this.revealed = false;
    this.parent = null;
  }

  absoluteX() {
    return this.parent ? this.parent.absoluteX() + this.x : this.x;
  }

  absoluteY() {
    return this.parent ? this.parent.absoluteY() + this.y : this.y;
  }

  isHoveredAt(mx, my) {
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    return mx >= ax && mx <= ax + this.width && my >= ay && my <= ay + this.height;
  }

  isChildHovered() {
    return false;
  }

  handleMouseMove(mx, my) {
    this.mouseX = mx;
    this.mouseY = my;
  }

  eyeCenter() {
    const s = childScale(this);
    return {
      x: this.absoluteX() + this.width - 6 * s,
      y: this.absoluteY() + this.height / 2,
    };
  }

  eyeHit(mx, my) {
    const c = this.eyeCenter();
    const dx = mx - c.x;
    const dy = my - c.y;
    const r = 4 * childScale(this);
    return dx * dx + dy * dy <= r * r;
  }

  displayText() {
    if (this.isPassword && !this.revealed) return '\u2022'.repeat(this.value.length);
    return this.value;
  }

  render(gfx) {
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    const s = childScale(this);
    const radius = 2.5 * s;

    gfx.drawRoundRect(ax, ay, this.width, this.height, radius, 0xffffffff);
    strokeRoundRect(
      gfx,
      ax + 0.25 * s,
      ay + 0.25 * s,
      this.width - 0.5 * s,
      this.height - 0.5 * s,
      radius,
      this.error ? 0xffe05a5a : this.focused ? 0xfffba0be : 0xffb0b0b0,
      (this.error || this.focused ? 0.7 : 0.4) * s
    );

    const font = FontSet.SH_REGULAR.getFont(9 * s);
    const textX = ax + 3 * s;
    const textY = ay + (this.height - font.getHeight()) / 2;
    const text = this.displayText();
    if (text.length === 0) {
      font.drawString(gfx, this.placeholder, textX, textY, 0xff9a9a9a);
    } else {
      font.drawString(gfx, text, textX, textY, 0xff353535);
    }

    if (this.focused && caretVisible()) {
      const caretX = textX + font.measureWidth(gfx, text) + 0.4 * s;
      gfx.drawRect(caretX, textY + 0.5 * s, 0.6 * s, Math.max(2 * s, font.getHeight() - 1 * s), 0xff353535);
    }

    if (this.isPassword) {
      const c = this.eyeCenter();
      drawEyeIcon(gfx, c.x, c.y, 3.2 * s, this.revealed ? 0xfffba0be : 0xff8a8a8a, this.revealed);
    }
  }
}

/** 记住我 checkbox, drawn in the same flat, rounded style as the buttons. */
class CheckboxChild {
  constructor(label) {
    this.x = 0;
    this.y = 0;
    this.size = 7;
    this.label = label;
    this.checked = true;
    this.parent = null;
  }

  absoluteX() {
    return this.parent ? this.parent.absoluteX() + this.x : this.x;
  }

  absoluteY() {
    return this.parent ? this.parent.absoluteY() + this.y : this.y;
  }

  labelFont() {
    return FontSet.SH_REGULAR.getFont(9 * childScale(this));
  }

  isHoveredAt(mx, my) {
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    if (mx >= ax && mx <= ax + this.size && my >= ay && my <= ay + this.size) return true;
    const font = this.labelFont();
    const labelX = ax + this.size + 3 * childScale(this);
    const labelY = ay + (this.size - font.getHeight()) / 2;
    return (
      mx >= labelX &&
      mx <= labelX + font.getStringWidth(this.label) &&
      my >= labelY &&
      my <= labelY + font.getHeight()
    );
  }

  isChildHovered() {
    return false;
  }

  handleMouseMove(mx, my) {
    this.mouseX = mx;
    this.mouseY = my;
  }

  toggle() {
    this.checked = !this.checked;
  }

  render(gfx) {
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    const s = this.size;
    const u = childScale(this);

    gfx.drawRoundRect(ax, ay, s, s, 1.5 * u, this.checked ? 0xff353535 : 0xffffffff);
    if (!this.checked)
      strokeRoundRect(gfx, ax + 0.25 * u, ay + 0.25 * u, s - 0.5 * u, s - 0.5 * u, 1.5 * u, 0xff353535, 0.5 * u);

    if (this.checked) {
      const ctx = gfx.ctx;
      ctx.save();
      ctx.strokeStyle = cssColor(0xffffffff);
      ctx.lineWidth = 1 * u;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(ax + s * 0.24, ay + s * 0.52);
      ctx.lineTo(ax + s * 0.44, ay + s * 0.72);
      ctx.lineTo(ax + s * 0.78, ay + s * 0.28);
      ctx.stroke();
      ctx.restore();
    }

    const font = this.labelFont();
    font.drawString(
      gfx,
      this.label,
      ax + s + 3 * u,
      ay + (s - font.getHeight()) / 2,
      0xff353535
    );
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
    const u = childScale(this);
    const parentHeight = this.parent ? this.parent.height : 0;
    const tipOffset = 10 * u;
    const halfWidth = 5 * u;
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
    if (triangleContains(p.a.x, p.a.y, p.b.x, p.b.y, p.c.x, p.c.y, mx, my)) return true;
    // The grey knob is the tap / click target that opens the card.
    const u = childScale(this);
    const dx = mx - (p.ax + 1.5 * u);
    const dy = my - p.ay;
    const r = 5 * u;
    return dx * dx + dy * dy <= r * r;
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
    gfx.drawCircle(p.ax + 1.5 * childScale(this), p.ay, 3 * childScale(this), 0xffebebeb);
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
    this.cardScale = 1;
    this.isPhone = false;
    this.touch = isTouchDevice();
    this.frameWidth = 0;
    this.hoverLock = false;
    this.formStartY = HEADER_BOTTOM;

    this.loggedIn = false;
    this.username = '';
    this.otp = new Array(OTP_LENGTH).fill('');
    this.otpIndex = 0;
    this.loginError = false;
    this.otpBoxes = [];
    this.logoutRect = null;
    this.verifyRect = null;
    this.manageRect = null;

    this.expandChild = new ExpandArrowChild();
    this.accountField = new InputField('邮箱或用户名', false);
    this.passwordField = new InputField('请输入密码', true);
    this.remember = new CheckboxChild('记住我');
    this.loginButton = new ButtonChild(null, '登录');

    this.fields = [this.accountField, this.passwordField];
    this.children = [
      this.expandChild,
      this.accountField,
      this.passwordField,
      this.remember,
      this.loginButton,
    ];
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
    if (this.loggedIn) {
      this.applyProfileLayout();
      return;
    }
    // The card is content-sized, so the form simply sits below the title. Every
    // measurement is in card units, multiplied by the responsive card scale.
    const u = this.cardScale;
    this.formStartY = (HEADER_BOTTOM + FORM_TOP_GAP) * u;

    this.accountField.x = FORM_X * u;
    this.accountField.y = this.formStartY + FORM_FIELD_1 * u;
    this.accountField.width = FORM_WIDTH * u;
    this.accountField.height = FORM_FIELD_HEIGHT * u;

    this.passwordField.x = FORM_X * u;
    this.passwordField.y = this.formStartY + FORM_FIELD_2 * u;
    this.passwordField.width = FORM_WIDTH * u;
    this.passwordField.height = FORM_FIELD_HEIGHT * u;

    this.remember.x = FORM_X * u;
    this.remember.y = this.formStartY + FORM_REMEMBER * u;
    this.remember.size = FORM_REMEMBER_SIZE * u;

    this.loginButton.x = FORM_X * u;
    this.loginButton.y = this.formStartY + FORM_LOGIN * u;
    this.loginButton.width = FORM_WIDTH * u;
    this.loginButton.height = FORM_FIELD_HEIGHT * u;
  }

  /** Lays out the signed-in view and caches its click targets. */
  applyProfileLayout() {
    const u = this.cardScale;
    const absX = this.absoluteX();
    const absY = this.absoluteY();
    const cx = absX + this.width / 2;

    // One-time password boxes.
    const boxes = [];
    const boxSize = PROFILE.boxSize * u;
    const gap = PROFILE.boxGap * u;
    const totalW = OTP_LENGTH * boxSize + (OTP_LENGTH - 1) * gap;
    let bx = cx - totalW / 2;
    const by = absY + PROFILE.boxTop * u;
    for (let i = 0; i < OTP_LENGTH; i++) {
      boxes.push({ x: bx, y: by, w: boxSize, h: boxSize });
      bx += boxSize + gap;
    }
    this.otpBoxes = boxes;

    // "注销 | 验证方法"
    const linkFont = FontSet.SH_BOLD.getFont(PROFILE.linkSize * u);
    const logoutW = linkFont.getStringWidth('注销');
    const verifyW = linkFont.getStringWidth('验证方法');
    const sepW = linkFont.getStringWidth('|');
    const linkGap = PROFILE.linkGap * u;
    const total = logoutW + linkGap + sepW + linkGap + verifyW;
    let lx = cx - total / 2;
    const ly = absY + PROFILE.linksTop * u;
    const lh = linkFont.getHeight();
    this.logoutRect = { x: lx, y: ly, w: logoutW, h: lh };
    lx += logoutW + linkGap + sepW + linkGap;
    this.verifyRect = { x: lx, y: ly, w: verifyW, h: lh };

    // "管理设备"
    const manageFont = FontSet.SH_REGULAR.getFont(PROFILE.linkSize * u);
    const manageW = manageFont.getStringWidth('管理设备');
    this.manageRect = {
      x: cx - manageW / 2,
      y: absY + PROFILE.linkTop * u,
      w: manageW,
      h: manageFont.getHeight(),
    };
  }

  handleMouseMove(mouseX, mouseY) {
    this.mouseX = mouseX;
    this.mouseY = mouseY;
    let childHovered = false;
    const active = this.loggedIn ? [this.expandChild] : this.children;
    for (const child of active) {
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

  /** Pointer press routed from the app shell (canvas coordinates). */
  handleClick(mouseX, mouseY) {
    // The grey knob / arrow on the panel edge toggles the card.
    if (this.expandChild.isHoveredAt(mouseX, mouseY)) {
      const next = !this.expandState;
      this.setExpanded(next);
      // While the pointer is still over the panel after a manual collapse, do
      // not let hover immediately re-open it.
      this.hoverLock = !next;
      this.blurFields();
      return;
    }

    // Touch devices have no hover, so the card is opened by tapping the
    // right-edge handle and closed by tapping outside it.
    if (this.touch && !this.isPhone && !this.forceExpand) {
      if (this.expandAnimation.currentValue < 0.5) {
        const openZone = Math.max(24, this.width * 0.4);
        if (mouseX >= this.frameWidth - openZone) this.setExpanded(true);
        this.blurFields();
        return;
      }
      const ax = this.absoluteX();
      const ay = this.absoluteY();
      const inside =
        mouseX >= ax && mouseX <= ax + this.width && mouseY >= ay && mouseY <= ay + this.height;
      if (!inside) {
        this.setExpanded(false);
        this.blurFields();
        return;
      }
    }

    if (this.loggedIn) {
      this.handleProfileClick(mouseX, mouseY);
      return;
    }

    if (this.passwordField.isHoveredAt(mouseX, mouseY)) {
      if (this.passwordField.eyeHit(mouseX, mouseY)) {
        this.passwordField.revealed = !this.passwordField.revealed;
      }
      this.focusField(this.passwordField);
      return;
    }
    if (this.accountField.isHoveredAt(mouseX, mouseY)) {
      this.focusField(this.accountField);
      return;
    }
    if (this.remember.isHoveredAt(mouseX, mouseY)) {
      this.remember.toggle();
      this.blurFields();
      return;
    }
    if (this.loginButton.isHoveredAt(mouseX, mouseY)) {
      this.submit();
      this.blurFields();
      return;
    }
    this.blurFields();
  }

  /** Keyboard routed from the app shell. Returns true when the key was consumed. */
  handleKeyDown(event) {
    if (this.loggedIn) return this.handleOtpKey(event);

    const field = this.focusedField();
    if (!field) return false;

    const key = event.key;
    if (key === 'Backspace') {
      field.value = field.value.slice(0, -1);
      return true;
    }
    if (key === 'Delete') {
      field.value = '';
      return true;
    }
    if (key === 'Enter') {
      this.submit();
      return true;
    }
    if (key === 'Escape') {
      this.blurFields();
      return true;
    }
    if (key === 'Tab') {
      this.focusField(field === this.accountField ? this.passwordField : this.accountField);
      return true;
    }
    if (key.length === 1) {
      field.value += key;
      return true;
    }
    return false;
  }

  focusedField() {
    return this.fields.find((field) => field.focused) ?? null;
  }

  focusField(field) {
    for (const other of this.fields) other.focused = other === field;
  }

  blurFields() {
    for (const field of this.fields) field.focused = false;
  }

  /** Validates the demo credentials and switches to the signed-in view. */
  submit() {
    const account = this.accountField.value.trim();
    const password = this.passwordField.value;
    if (account === DEMO_USER && password === DEMO_PASSWORD) {
      this.username = account;
      this.loggedIn = true;
      this.loginError = false;
      this.otp = new Array(OTP_LENGTH).fill('');
      this.otpIndex = 0;
    } else {
      this.loginError = true;
    }
    this.blurFields();
  }

  logout() {
    this.loggedIn = false;
    this.loginError = false;
    this.otp = new Array(OTP_LENGTH).fill('');
    this.otpIndex = 0;
    this.blurFields();
  }

  /** Digits typed into the one-time password boxes. */
  handleOtpKey(event) {
    const key = event.key;
    if (key === 'Backspace') {
      if (this.otp[this.otpIndex]) {
        this.otp[this.otpIndex] = '';
      } else if (this.otpIndex > 0) {
        this.otpIndex -= 1;
        this.otp[this.otpIndex] = '';
      }
      return true;
    }
    if (key.length === 1 && key >= '0' && key <= '9') {
      this.otp[this.otpIndex] = key;
      if (this.otpIndex < OTP_LENGTH - 1) this.otpIndex += 1;
      return true;
    }
    return false;
  }

  handleProfileClick(mx, my) {
    const hit = (rect) =>
      rect && mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
    if (hit(this.logoutRect)) {
      this.logout();
      return;
    }
    if (hit(this.manageRect) || hit(this.verifyRect)) return;
    const index = this.otpBoxes.findIndex(
      (box) => mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h
    );
    if (index >= 0) this.otpIndex = index;
  }

  update(frame) {
    this.expandAnimation.update();
    if (this.fadeInAnimation) this.fadeInAnimation.update();

    const cssWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1024;
    const isPhone = cssWidth < 600;
    this.isPhone = isPhone;

    const fade = this.fadeInAnimation ? this.fadeInAnimation.currentValue : 0;
    const baseWidth = this.loggedIn ? PROFILE.width : BASE_WIDTH;
    const baseHeight = this.loggedIn ? PROFILE.height : PANEL_HEIGHT;
    this.cardScale = computeCardScale(isPhone, baseWidth, baseHeight);
    this.width = baseWidth * this.cardScale;
    this.height = baseHeight * this.cardScale;

    if (isPhone) {
      // Phone: a centred card that rises from the bottom and is always shown.
      this.x = (frame.scaledWidth - this.width) / 2;
      this.y = mlerp(fade, frame.scaledHeight + 20, (frame.scaledHeight - this.height) / 2);
    } else {
      // Desktop / tablet: a side panel that slides in from the right on hover.
      const lerp = this.expandAnimation.currentValue;
      this.x = mlerp(
        fade,
        frame.scaledWidth + 10,
        mlerp(lerp, frame.scaledWidth - this.width / 10, frame.scaledWidth - this.width)
      );
      this.y = (frame.scaledHeight - this.height) / 2;
    }

    this.frameWidth = frame.scaledWidth;
    this.accountField.error = this.loginError;
    this.passwordField.error = this.loginError;
    this.expandChild.y = this.height / 2;
    this.applyLayout();

    const isValidMousePos = this.mouseX !== 0 || this.mouseY !== 0;
    // Release the manual-collapse lock once the pointer leaves the card.
    if (this.hoverLock && !this.hovered && !this.childHovered) this.hoverLock = false;

    if (isPhone || this.forceExpand) {
      if (!this.expandState) this.setExpanded(true);
    } else if (this.touch) {
      // Touch devices have no hover: the card is opened by a tap (handleClick).
    } else if (!this.hoverLock && (this.hovered || (this.childHovered && isValidMousePos))) {
      if (!this.expandState) this.setExpanded(true);
    } else if (this.expandState) {
      this.setExpanded(false);
    }
  }

  /** Starts the expand / collapse animation towards `expanded`. */
  setExpanded(expanded) {
    if (this.expandState === expanded) return;
    this.expandState = expanded;
    this.expandAnimation = expanded
      ? BezierAnimation.createFloat(0, 1, 300, CP.CUBIC_OUT)
      : BezierAnimation.createFloat(1, 0, 600, CP.CUBIC_OUT);
    this.expandAnimation.start();
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
    const u = this.cardScale;
    const borderWidth = 5 * u;

    gfx.drawRect(absX, absY, borderWidth, this.height, 0xffffffff);
    gfx.drawRect(absX + borderWidth, absY, this.width - borderWidth, this.height, 0xfff5f5f5);

    if (this.loggedIn) {
      this.renderProfile(gfx, mouseX, mouseY);
      void ctx;
      return;
    }

    const titleFont = FontSet.SH_HEAVY.getFont(21 * u);
    const titleText = 'Login';
    const titleWidth = titleFont.getStringWidth(titleText, -0.1 * u);
    const titlePosX = absX + titleWidth / 2;
    const titlePosY = absY + titleFont.getHeight() + 3 * u;

    titleFont.drawString(gfx, titleText, titlePosX, titlePosY, 0xff353535, -0.1 * u);
    gfx.drawLine(
      titlePosX - 2.5 * u,
      titlePosY + titleFont.getHeight() + 2.5 * u,
      titlePosX + titleWidth + 2.5 * u,
      titlePosY + titleFont.getHeight() + 2.5 * u,
      0x66353535,
      0.2 * u
    );

    // Form labels live between the fields.
    const formX = absX + FORM_X * u;
    const startY = absY + this.formStartY;
    const labelFont = FontSet.SH_BOLD.getFont(9 * u);
    labelFont.drawString(gfx, '账号', formX, startY + FORM_LABEL_1 * u, 0xff353535);
    labelFont.drawString(gfx, '密码', formX, startY + FORM_LABEL_2 * u, 0xff353535);

    // "Reset password?" link, right-aligned on the remember-me row.
    const linkFont = FontSet.SH_REGULAR.getFont(9 * u);
    const linkText = '重置密码?';
    const linkWidth = linkFont.getStringWidth(linkText);
    const linkX = formX + FORM_WIDTH * u - linkWidth;
    const linkY = startY + FORM_REMEMBER * u + (this.remember.size - linkFont.getHeight()) / 2;
    linkFont.drawString(gfx, linkText, linkX, linkY, 0xff6a6a6a);
    gfx.drawLine(
      linkX,
      linkY + linkFont.getHeight() + 0.6 * u,
      linkX + linkWidth,
      linkY + linkFont.getHeight() + 0.6 * u,
      0xff6a6a6a,
      0.25 * u
    );

    if (!this.isPhone) this.expandChild.render(gfx, mouseX, mouseY);
    this.accountField.render(gfx, mouseX, mouseY);
    this.passwordField.render(gfx, mouseX, mouseY);
    this.remember.render(gfx, mouseX, mouseY);
    this.loginButton.render(gfx, mouseX, mouseY);

    void ctx;
  }

  /** The signed-in "one-time password" view. */
  renderProfile(gfx, mouseX, mouseY) {
    const u = this.cardScale;
    const absX = this.absoluteX();
    const absY = this.absoluteY();
    const cx = absX + this.width / 2;

    drawAvatar(gfx, cx, absY + PROFILE.avatarCy * u, PROFILE.avatarR * u);

    const nameFont = FontSet.SH_BOLD.getFont(PROFILE.nameSize * u);
    const name = `Hi ${this.username}`;
    const nameW = nameFont.getStringWidth(name);
    nameFont.drawString(gfx, name, cx - nameW / 2, absY + PROFILE.nameTop * u, COLOR_INK);

    const linkFont = FontSet.SH_BOLD.getFont(PROFILE.linkSize * u);
    const linkGap = PROFILE.linkGap * u;
    const ly = absY + PROFILE.linksTop * u;
    linkFont.drawString(gfx, '注销', this.logoutRect.x, ly, COLOR_PINK);
    linkFont.drawString(gfx, '|', this.logoutRect.x + this.logoutRect.w + linkGap, ly, COLOR_MUTED);
    linkFont.drawString(gfx, '验证方法', this.verifyRect.x, ly, COLOR_PINK);

    // One-time password card.
    const cardX = absX + PROFILE.otpX * u;
    const cardY = absY + PROFILE.otpTop * u;
    const cardW = (PROFILE.otpRight - PROFILE.otpX) * u;
    const cardH = (PROFILE.otpBottom - PROFILE.otpTop) * u;
    const radius = PROFILE.otpRadius * u;
    gfx.drawRoundRect(cardX, cardY, cardW, cardH, radius, 0xffffffff);
    strokeRoundRect(
      gfx,
      cardX + 0.25 * u,
      cardY + 0.25 * u,
      cardW - 0.5 * u,
      cardH - 0.5 * u,
      radius,
      COLOR_HAIRLINE,
      0.5 * u
    );

    const titleFont = FontSet.SH_BOLD.getFont(PROFILE.otpTitleSize * u);
    const title = '一次性密码';
    const titleW = titleFont.getStringWidth(title);
    titleFont.drawString(gfx, title, cx - titleW / 2, absY + PROFILE.otpTitleTop * u, COLOR_INK);

    drawClock(gfx, cx, absY + PROFILE.clockCy * u, PROFILE.clockR * u);

    const digitFont = FontSet.SH_BOLD.getFont(PROFILE.boxSize * 1.1 * u);
    for (let i = 0; i < this.otpBoxes.length; i++) {
      const box = this.otpBoxes[i];
      const focused = i === this.otpIndex;
      gfx.drawRoundRect(box.x, box.y, box.w, box.h, 1.5 * u, 0xffffffff);
      strokeRoundRect(
        gfx,
        box.x + 0.25 * u,
        box.y + 0.25 * u,
        box.w - 0.5 * u,
        box.h - 0.5 * u,
        1.5 * u,
        focused ? COLOR_INK : COLOR_HAIRLINE,
        (focused ? 1 : 0.6) * u
      );
      const digit = this.otp[i];
      if (digit) {
        const dw = digitFont.getStringWidth(digit);
        digitFont.drawString(
          gfx,
          digit,
          box.x + (box.w - dw) / 2,
          box.y + (box.h - digitFont.getHeight()) / 2,
          COLOR_INK
        );
      }
    }

    const hintFont = FontSet.SH_REGULAR.getFont(PROFILE.hintSize * u);
    const hint = '输入一次性密码';
    const hintW = hintFont.getStringWidth(hint);
    hintFont.drawString(gfx, hint, cx - hintW / 2, absY + PROFILE.hintTop * u, COLOR_MUTED);

    const manageFont = FontSet.SH_REGULAR.getFont(PROFILE.linkSize * u);
    const manage = '管理设备';
    const manageW = manageFont.getStringWidth(manage);
    manageFont.drawString(gfx, manage, cx - manageW / 2, absY + PROFILE.linkTop * u, COLOR_BLUE);

    if (!this.isPhone) this.expandChild.render(gfx, mouseX, mouseY);
  }
}
