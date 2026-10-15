// Panel model for the right-hand login card.
//
// The original mod drew this card with Skia; in this port it is a real DOM
// subtree (see guiDom.js). This class keeps the state the DOM renderer reads —
// the field values and the signed-in / one-time-password state — and the piece
// the canvas still owns: the expand / collapse animation that blurs and zooms
// the menu behind the card, plus the darkening overlay drawn inside that layer.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { mlerp, replaceAlpha } from '../../engine/color.js';
import {
  BASE_WIDTH,
  DEMO_PASSWORD,
  DEMO_USER,
  OTP_LENGTH,
  PANEL_HEIGHT,
  PROFILE,
  computeCardScale,
} from './panelLayout.js';
import { BaseComponent } from './base.js';

/**
 * True on touch-only devices (tablets / phones), where `:hover` never fires and
 * the card has to be opened by tapping the knob instead.
 */
function isTouchDevice() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (
    window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches
  );
}

/** Account / password field state. The DOM <input> is the source of truth. */
class InputField {
  constructor(placeholder, isPassword = false) {
    this.placeholder = placeholder;
    this.isPassword = isPassword;
    this.value = '';
    this.focused = false;
    this.revealed = false;
    this.error = false;
  }
}

/** 记住我 checkbox state. */
class Checkbox {
  constructor(label) {
    this.label = label;
    this.checked = true;
  }

  toggle() {
    this.checked = !this.checked;
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
    // Set by the DOM panel while the pointer is over its expand knob.
    this.knobHover = false;

    this.loggedIn = false;
    this.username = '';
    this.otp = new Array(OTP_LENGTH).fill('');
    this.otpIndex = 0;
    this.loginError = false;

    this.accountField = new InputField('邮箱或用户名', false);
    this.passwordField = new InputField('请输入密码', true);
    this.remember = new Checkbox('记住我');
    this.fields = [this.accountField, this.passwordField];
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

  /** Pointer position in GUI units, routed from the app shell each frame. */
  handleMouseMove(mouseX, mouseY) {
    this.mouseX = mouseX;
    this.mouseY = mouseY;
    this.hovered =
      mouseX >= this.absoluteX() &&
      mouseX <= this.absoluteX() + this.width &&
      mouseY >= this.absoluteY() &&
      mouseY <= this.absoluteY() + this.height;
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

    // Release the manual-collapse lock once the pointer leaves the card.
    if (this.hoverLock && !this.hovered && !this.knobHover) this.hoverLock = false;

    if (isPhone || this.forceExpand) {
      if (!this.expandState) this.setExpanded(true);
    } else if (this.touch) {
      // Touch devices have no hover: the card is opened by tapping the knob.
    } else if (!this.hoverLock && (this.hovered || this.knobHover)) {
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
}
