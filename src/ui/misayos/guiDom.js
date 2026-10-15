// DOM implementation of the right-hand login panel.
//
// The panel is a real DOM subtree (real <input> / <button> / <label> nodes, so
// it can be inspected, copied and edited like any other DOM) instead of being
// painted onto the canvas. It reuses the layout constants (panelLayout.js) and
// the font metrics (engine/font.js) the canvas renderer used, so every element
// lands on the same pixel.
//
// GuiComponent (guiComponent.js) is the model: it holds the field / login state
// and the expand animation that blurs and zooms the menu behind the card, which
// the canvas still draws. This module reads that state each frame in sync().
//
// Coordinates: everything below is written in "card units", laid out at
// DOM_SCALE times the card units and finished with `transform: scale(...)`.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { FontSet } from '../../engine/font.js';
import { cssColor, lerpColor, mlerp } from '../../engine/color.js';
import { viewport } from '../../engine/frame.js';
import {
  BASE_WIDTH,
  COLOR_BLUE,
  COLOR_HAIRLINE,
  COLOR_INK,
  COLOR_MUTED,
  COLOR_PINK,
  FORM_FIELD_1,
  FORM_FIELD_2,
  FORM_FIELD_HEIGHT,
  FORM_LABEL_1,
  FORM_LABEL_2,
  FORM_LOGIN,
  FORM_REMEMBER,
  FORM_REMEMBER_SIZE,
  FORM_TOP_GAP,
  FORM_WIDTH,
  FORM_X,
  HEADER_BOTTOM,
  OTP_LENGTH,
  PANEL_HEIGHT,
  PROFILE,
} from './panelLayout.js';

/** Same font stacks the canvas renderer uses, so Latin and CJK fall back alike. */
const CSS_FAMILY = {
  SH_LIGHT: '"Bocchi SH Light", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  SH_REGULAR: '"Bocchi SH Regular", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  SH_HEAVY: '"Bocchi SH Heavy", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  SH_NORMAL: '"Bocchi SH Normal", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  SH_BOLD: '"Bocchi SH Bold", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
};

const STYLE_ID = 'bocchi-dom-panel-style';

/**
 * The panel is authored in "card units", but the browser rounds text metrics to
 * whole pixels at the layout size. Laying out at the raw card-unit sizes (e.g.
 * a 4.5px font) and scaling up with `transform` amplifies that rounding into
 * several pixels of drift. Authoring at DOM_SCALE times the card units keeps the
 * layout at a normal text size so the baselines land where the canvas puts them.
 */
const DOM_SCALE = 4;

/** Card-unit width of `text` for a font size expressed in card units. */
function textWidth(family, cardSize, text, spacing = 0) {
  return FontSet[family].getFont(cardSize).getStringWidth(text, spacing);
}

/** Card-unit line height (top of the line box to its bottom) for a card-unit size. */
function lineHeight(family, cardSize) {
  return FontSet[family].getFont(cardSize).getHeight();
}

/** Positions an element in card units. */
function place(el, x, y, w, h) {
  el.style.position = 'absolute';
  el.style.left = `${x * DOM_SCALE}px`;
  el.style.top = `${y * DOM_SCALE}px`;
  if (w !== undefined) el.style.width = `${w * DOM_SCALE}px`;
  if (h !== undefined) el.style.height = `${h * DOM_SCALE}px`;
}

/**
 * The canvas draws text with the baseline at `y + getHeight()` and the glyphs
 * sized at `cardSize / 2`. Setting `line-height` to the same `getHeight()` makes
 * the browser place its baseline at exactly the same offset, so text lines up.
 */
function applyText(el, family, cardSize, color, spacing = 0) {
  el.style.fontFamily = CSS_FAMILY[family];
  el.style.fontSize = `${(cardSize / 2) * DOM_SCALE}px`;
  el.style.lineHeight = `${lineHeight(family, cardSize) * DOM_SCALE}px`;
  el.style.color = cssColor(color);
  el.style.letterSpacing = `${spacing * DOM_SCALE}px`;
}

function makeText(family, cardSize, color, text, spacing = 0) {
  const el = document.createElement('span');
  el.className = 'bp-text';
  el.textContent = text;
  applyText(el, family, cardSize, color, spacing);
  return el;
}

function makeSvg(width, height, viewBox, inner) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', width * DOM_SCALE);
  svg.setAttribute('height', height * DOM_SCALE);
  svg.innerHTML = inner;
  return svg;
}

/** Eye glyph for the password reveal toggle (mirrors drawEyeIcon). */
function eyeSvg(open) {
  const size = 3.2;
  const pupil = open
    ? `<circle cx="0" cy="0" r="${size * 0.42}" fill="none" stroke="currentColor" stroke-width="0.7"/>`
    : `<line x1="${-size}" y1="${size * 0.55}" x2="${size}" y2="${-size * 0.55}" stroke="currentColor" stroke-width="0.7" stroke-linecap="round"/>`;
  return makeSvg(
    8,
    8,
    '-4 -4 8 8',
    `<path d="M ${-size} 0 Q 0 ${-size * 0.9} ${size} 0 Q 0 ${size * 0.9} ${-size} 0" fill="none" stroke="currentColor" stroke-width="0.7" stroke-linecap="round"/>${pupil}`
  );
}

/** Circular silhouette avatar (mirrors drawAvatar). */
function avatarSvg() {
  const r = PROFILE.avatarR;
  const lw = Math.max(0.6, r * 0.07);
  const inner = r - lw / 2;
  const headCy = -r * 0.22;
  const headR = r * 0.3;
  const bodyCy = r * 0.72;
  const bodyR = r * 0.62;
  const box = r + 2;
  const inner_ = `<defs><clipPath id="bp-av-clip"><circle cx="0" cy="0" r="${inner}"/></clipPath></defs>
    <g clip-path="url(#bp-av-clip)" fill="${cssColor(COLOR_INK)}">
      <circle cx="0" cy="${headCy}" r="${headR}"/>
      <circle cx="0" cy="${bodyCy}" r="${bodyR}"/>
    </g>
    <circle cx="0" cy="0" r="${inner}" fill="none" stroke="${cssColor(COLOR_INK)}" stroke-width="${lw}"/>`;
  return makeSvg(box * 2, box * 2, `${-box} ${-box} ${box * 2} ${box * 2}`, inner_);
}

/** Pie / timer icon (mirrors drawClock). */
function clockSvg() {
  const r = PROFILE.clockR;
  const lw = Math.max(0.8, r * 0.16);
  const inner = r - lw / 2;
  const a0 = Math.PI * 0.85;
  const a1 = Math.PI * 1.55;
  const x0 = inner * Math.cos(a0);
  const y0 = inner * Math.sin(a0);
  const x1 = inner * Math.cos(a1);
  const y1 = inner * Math.sin(a1);
  const box = r + 1.5;
  const inner_ = `<path d="M 0 0 L ${x0} ${y0} A ${inner} ${inner} 0 0 1 ${x1} ${y1} Z" fill="${cssColor(COLOR_INK)}"/>
    <circle cx="0" cy="0" r="${inner}" fill="none" stroke="${cssColor(COLOR_INK)}" stroke-width="${lw}"/>`;
  return makeSvg(box * 2, box * 2, `${-box} ${-box} ${box * 2} ${box * 2}`, inner_);
}

function checkboxTickSvg() {
  const s = FORM_REMEMBER_SIZE;
  return makeSvg(
    s,
    s,
    `0 0 ${s} ${s}`,
    `<polyline points="${s * 0.24},${s * 0.52} ${s * 0.44},${s * 0.72} ${s * 0.78},${s * 0.28}" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.bocchi-dom-panel {
  position: absolute;
  pointer-events: none;
  z-index: 10;
  overflow: visible;
}
.bocchi-dom-panel .bp-scale {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  background: #f5f5f5;
  overflow: visible;
}
.bocchi-dom-panel .bp-bar {
  position: absolute;
  left: 0;
  top: 0;
  width: ${5 * DOM_SCALE}px;
  background: #ffffff;
}
.bocchi-dom-panel .bp-text {
  position: absolute;
  white-space: pre;
  -webkit-user-select: text;
  user-select: text;
}
.bocchi-dom-panel .bp-rule {
  position: absolute;
  background: rgba(53,53,53,0.4);
}
.bocchi-dom-panel .bp-link-action {
  pointer-events: auto;
  cursor: pointer;
}
.bocchi-dom-panel .bp-link-underline {
  background: #6a6a6a;
}
.bocchi-dom-panel .bp-knob {
  position: absolute;
  pointer-events: none;
  cursor: pointer;
}
.bocchi-dom-panel .bp-knob polygon,
.bocchi-dom-panel .bp-knob .bp-knob-hit {
  pointer-events: auto;
}
.bocchi-dom-panel .bp-field {
  position: absolute;
  box-sizing: border-box;
  background: #ffffff;
  border-radius: ${2.5 * DOM_SCALE}px;
  border: ${0.4 * DOM_SCALE}px solid #b0b0b0;
  overflow: hidden;
}
.bocchi-dom-panel .bp-field.is-focused {
  border-color: #fba0be;
  border-width: ${0.7 * DOM_SCALE}px;
}
.bocchi-dom-panel .bp-field.is-error {
  border-color: #e05a5a;
  border-width: ${0.7 * DOM_SCALE}px;
}
.bocchi-dom-panel .bp-input {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: 0;
  outline: none;
  background: transparent;
  padding: 0 ${8 * DOM_SCALE}px 0 ${3 * DOM_SCALE}px;
  color: #353535;
  pointer-events: auto;
}
.bocchi-dom-panel .bp-input::placeholder {
  color: #9a9a9a;
}
/* The browser draws its own password-reveal control inside <input type=password>
   (Edge/Chromium); hide it so only the design's own eye button shows. */
.bocchi-dom-panel .bp-input::-ms-reveal,
.bocchi-dom-panel .bp-input::-ms-clear {
  display: none;
}
.bocchi-dom-panel .bp-eye {
  position: absolute;
  display: block;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: #8a8a8a;
  pointer-events: auto;
  cursor: pointer;
}
.bocchi-dom-panel .bp-eye.is-revealed {
  color: #fba0be;
}
.bocchi-dom-panel .bp-eye svg {
  display: block;
  width: 100%;
  height: 100%;
}
.bocchi-dom-panel .bp-check {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;
}
.bocchi-dom-panel .bp-check-box {
  position: absolute;
  box-sizing: border-box;
  border-radius: ${1.5 * DOM_SCALE}px;
}
.bocchi-dom-panel .bp-check-box svg {
  display: block;
  width: 100%;
  height: 100%;
}
.bocchi-dom-panel .bp-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: 0;
  cursor: pointer;
  color: #ffffff;
  font-family: inherit;
  pointer-events: auto;
}
.bocchi-dom-panel .bp-btn span {
  line-height: 1;
}
.bocchi-dom-panel .bp-otp-card {
  position: absolute;
  box-sizing: border-box;
  background: #ffffff;
  border-radius: ${5 * DOM_SCALE}px;
  border: ${0.5 * DOM_SCALE}px solid ${cssColor(COLOR_HAIRLINE)};
}
.bocchi-dom-panel .bp-otp-box {
  position: absolute;
  box-sizing: border-box;
  background: #ffffff;
  border-radius: ${1.5 * DOM_SCALE}px;
  border: ${0.6 * DOM_SCALE}px solid ${cssColor(COLOR_HAIRLINE)};
  text-align: center;
  padding: 0;
  outline: none;
  color: ${cssColor(COLOR_INK)};
  pointer-events: auto;
}
.bocchi-dom-panel .bp-otp-box:focus {
  border-color: ${cssColor(COLOR_INK)};
  border-width: ${1 * DOM_SCALE}px;
}
.bocchi-dom-panel .bp-hidden {
  display: none !important;
}
`;
  document.head.appendChild(style);
}

export class DomLoginPanel {
  constructor(gui, app) {
    this.gui = gui;
    this.app = app;
    ensureStyle();

    // The login button re-creates its hover animation on enter/leave exactly
    // like ButtonChild#render does.
    this.loginHoverAnim = BezierAnimation.createFloat(0, 1, 300, CP.CUBIC_OUT);
    this.loginHovered = false;
    // Cached state so per-frame sync only touches the DOM when something changed.
    this.knobBaseHeight = 0;
    this.rememberChecked = null;

    this.root = document.createElement('div');
    this.root.className = 'bocchi-dom-panel';
    this.scale = document.createElement('div');
    this.scale.className = 'bp-scale';
    this.root.appendChild(this.scale);

    this.buildKnob();
    this.loginView = this.buildLogin();
    this.profileView = this.buildProfile();
    this.scale.appendChild(this.loginView);
    this.scale.appendChild(this.profileView);

    const host = this.app.canvas.parentElement || document.body;
    host.appendChild(this.root);

    this.bind();
  }

  /** The grey knob / arrow that toggles the card, shared by both views. */
  buildKnob() {
    this.knob = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.knob.setAttribute('class', 'bp-knob');
    this.knob.setAttribute('viewBox', '-10 -10 15 20');
    this.knob.setAttribute('width', `${15 * DOM_SCALE}`);
    this.knob.setAttribute('height', `${20 * DOM_SCALE}`);
    this.knobPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    this.knobPoly.setAttribute('fill', '#ffffff');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '1.5');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', '#ebebeb');
    // Invisible hit target matching ExpandArrowChild#isHoveredAt's 5-unit knob
    // radius, so the hover region matches the canvas version.
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hit.setAttribute('class', 'bp-knob-hit');
    hit.setAttribute('cx', '1.5');
    hit.setAttribute('cy', '0');
    hit.setAttribute('r', '5');
    hit.setAttribute('fill', 'transparent');
    this.knob.appendChild(this.knobPoly);
    this.knob.appendChild(circle);
    this.knob.appendChild(hit);
    this.scale.appendChild(this.knob);

    this.knob.addEventListener('mouseenter', () => {
      this.gui.knobHover = true;
    });
    this.knob.addEventListener('mouseleave', () => {
      this.gui.knobHover = false;
    });
    this.knob.addEventListener('click', () => {
      const next = !this.gui.expandState;
      this.gui.setExpanded(next);
      this.gui.hoverLock = !next;
      this.gui.blurFields();
    });
  }

  makeField(placeholder, isPassword) {
    const wrap = document.createElement('div');
    wrap.className = 'bp-field';
    const input = document.createElement('input');
    input.className = 'bp-input';
    input.placeholder = placeholder;
    input.type = isPassword ? 'password' : 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    applyText(input, 'SH_REGULAR', 9, 0xff353535);
    input.style.fontSize = `${(9 / 2) * DOM_SCALE}px`;
    input.style.lineHeight = `${FORM_FIELD_HEIGHT * DOM_SCALE}px`;
    wrap.appendChild(input);

    let eye = null;
    if (isPassword) {
      eye = document.createElement('button');
      eye.type = 'button';
      eye.className = 'bp-eye';
      eye.appendChild(eyeSvg(false));
      place(eye, FORM_WIDTH - 6 - 4, FORM_FIELD_HEIGHT / 2 - 4, 8, 8);
      wrap.appendChild(eye);
    }
    return { wrap, input, eye };
  }

  makeCheckbox(label) {
    const wrap = document.createElement('div');
    wrap.className = 'bp-check';
    const s = FORM_REMEMBER_SIZE;

    const box = document.createElement('div');
    box.className = 'bp-check-box';
    place(box, 0, 0, s, s);
    wrap.appendChild(box);

    const text = makeText('SH_REGULAR', 9, 0xff353535, label);
    place(text, s + 3, (s - lineHeight('SH_REGULAR', 9)) / 2);
    wrap.appendChild(text);

    wrap.addEventListener('click', (event) => {
      event.preventDefault();
      this.gui.remember.toggle();
    });
    return { wrap, box };
  }

  buildLogin() {
    const view = document.createElement('div');
    view.className = 'bp-view bp-login';

    const bar = document.createElement('div');
    bar.className = 'bp-bar';
    bar.style.height = `${PANEL_HEIGHT * DOM_SCALE}px`;
    view.appendChild(bar);

    const titleW = textWidth('SH_HEAVY', 21, 'Login', -0.1);
    const titleH = lineHeight('SH_HEAVY', 21);
    const title = makeText('SH_HEAVY', 21, 0xff353535, 'Login', -0.1);
    place(title, titleW / 2, titleH + 3);
    view.appendChild(title);

    const rule = document.createElement('div');
    rule.className = 'bp-rule';
    rule.style.height = `${0.2 * DOM_SCALE}px`;
    place(rule, titleW / 2 - 2.5, titleH + 3 + titleH + 2.5, titleW + 5);
    view.appendChild(rule);

    const startY = HEADER_BOTTOM + FORM_TOP_GAP;

    const label1 = makeText('SH_BOLD', 9, 0xff353535, '账号');
    place(label1, FORM_X, startY + FORM_LABEL_1);
    view.appendChild(label1);

    this.accountField = this.makeField('邮箱或用户名', false);
    place(this.accountField.wrap, FORM_X, startY + FORM_FIELD_1, FORM_WIDTH, FORM_FIELD_HEIGHT);
    view.appendChild(this.accountField.wrap);

    const label2 = makeText('SH_BOLD', 9, 0xff353535, '密码');
    place(label2, FORM_X, startY + FORM_LABEL_2);
    view.appendChild(label2);

    this.passwordField = this.makeField('请输入密码', true);
    place(this.passwordField.wrap, FORM_X, startY + FORM_FIELD_2, FORM_WIDTH, FORM_FIELD_HEIGHT);
    view.appendChild(this.passwordField.wrap);

    this.remember = this.makeCheckbox('记住我');
    place(this.remember.wrap, FORM_X, startY + FORM_REMEMBER, FORM_REMEMBER_SIZE + 3 + 20, FORM_REMEMBER_SIZE);
    view.appendChild(this.remember.wrap);

    const linkText = '重置密码?';
    const linkW = textWidth('SH_REGULAR', 9, linkText);
    const linkH = lineHeight('SH_REGULAR', 9);
    const linkX = FORM_X + FORM_WIDTH - linkW;
    const linkY = startY + FORM_REMEMBER + (FORM_REMEMBER_SIZE - linkH) / 2;
    const link = makeText('SH_REGULAR', 9, 0xff6a6a6a, linkText);
    place(link, linkX, linkY);
    view.appendChild(link);
    const linkUnderline = document.createElement('div');
    linkUnderline.className = 'bp-rule bp-link-underline';
    linkUnderline.style.height = `${0.25 * DOM_SCALE}px`;
    place(linkUnderline, linkX, linkY + linkH + 0.6, linkW);
    view.appendChild(linkUnderline);

    this.loginBtn = document.createElement('button');
    this.loginBtn.type = 'button';
    this.loginBtn.className = 'bp-btn';
    this.loginText = document.createElement('span');
    this.loginText.textContent = '登录';
    this.loginBtn.appendChild(this.loginText);
    place(this.loginBtn, FORM_X, startY + FORM_LOGIN, FORM_WIDTH, FORM_FIELD_HEIGHT);
    view.appendChild(this.loginBtn);

    return view;
  }

  buildProfile() {
    const view = document.createElement('div');
    view.className = 'bp-view bp-profile';

    const bar = document.createElement('div');
    bar.className = 'bp-bar';
    bar.style.height = `${PROFILE.height * DOM_SCALE}px`;
    view.appendChild(bar);

    const cx = PROFILE.width / 2;

    const avatar = avatarSvg();
    place(avatar, cx - PROFILE.avatarR - 2, PROFILE.avatarCy - PROFILE.avatarR - 2);
    view.appendChild(avatar);

    this.nameText = makeText('SH_BOLD', PROFILE.nameSize, COLOR_INK, 'Hi');
    view.appendChild(this.nameText);

    const linkFont = 'SH_BOLD';
    const logoutW = textWidth(linkFont, PROFILE.linkSize, '注销');
    const verifyW = textWidth(linkFont, PROFILE.linkSize, '验证方法');
    const sepW = textWidth(linkFont, PROFILE.linkSize, '|');
    const linkGap = PROFILE.linkGap;
    const total = logoutW + linkGap + sepW + linkGap + verifyW;
    let lx = cx - total / 2;
    const logout = makeText(linkFont, PROFILE.linkSize, COLOR_PINK, '注销');
    logout.classList.add('bp-link-action');
    place(logout, lx, PROFILE.linksTop);
    logout.addEventListener('click', () => this.gui.logout());
    view.appendChild(logout);
    lx += logoutW + linkGap;
    const sep = makeText(linkFont, PROFILE.linkSize, COLOR_MUTED, '|');
    place(sep, lx, PROFILE.linksTop);
    view.appendChild(sep);
    lx += sepW + linkGap;
    const verify = makeText(linkFont, PROFILE.linkSize, COLOR_PINK, '验证方法');
    place(verify, lx, PROFILE.linksTop);
    view.appendChild(verify);

    const card = document.createElement('div');
    card.className = 'bp-otp-card';
    place(card, PROFILE.otpX, PROFILE.otpTop, PROFILE.otpRight - PROFILE.otpX, PROFILE.otpBottom - PROFILE.otpTop);
    view.appendChild(card);

    const otpTitle = makeText('SH_BOLD', PROFILE.otpTitleSize, COLOR_INK, '一次性密码');
    const otpTitleW = textWidth('SH_BOLD', PROFILE.otpTitleSize, '一次性密码');
    place(otpTitle, cx - otpTitleW / 2, PROFILE.otpTitleTop);
    view.appendChild(otpTitle);

    const clock = clockSvg();
    const clockBox = PROFILE.clockR + 1.5;
    place(clock, cx - clockBox, PROFILE.clockCy - clockBox);
    view.appendChild(clock);

    // One-time password boxes: real single-character inputs.
    this.otpInputs = [];
    const boxSize = PROFILE.boxSize;
    const gap = PROFILE.boxGap;
    const totalW = OTP_LENGTH * boxSize + (OTP_LENGTH - 1) * gap;
    let bx = cx - totalW / 2;
    for (let i = 0; i < OTP_LENGTH; i++) {
      const box = document.createElement('input');
      box.className = 'bp-otp-box';
      box.type = 'text';
      box.inputMode = 'numeric';
      box.maxLength = 1;
      box.autocomplete = 'off';
      applyText(box, 'SH_BOLD', PROFILE.boxSize * 1.1, COLOR_INK);
      box.style.lineHeight = `${boxSize * DOM_SCALE}px`;
      place(box, bx, PROFILE.boxTop, boxSize, boxSize);
      view.appendChild(box);
      this.otpInputs.push(box);
      bx += boxSize + gap;
    }

    const hint = makeText('SH_REGULAR', PROFILE.hintSize, COLOR_MUTED, '输入一次性密码');
    const hintW = textWidth('SH_REGULAR', PROFILE.hintSize, '输入一次性密码');
    place(hint, cx - hintW / 2, PROFILE.hintTop);
    view.appendChild(hint);

    const manage = makeText('SH_REGULAR', PROFILE.linkSize, COLOR_BLUE, '管理设备');
    const manageW = textWidth('SH_REGULAR', PROFILE.linkSize, '管理设备');
    place(manage, cx - manageW / 2, PROFILE.linkTop);
    view.appendChild(manage);

    return view;
  }

  bind() {
    const syncField = (field, target) => {
      field.input.addEventListener('input', () => {
        target.value = field.input.value;
      });
      field.input.addEventListener('focus', () => this.gui.focusField(target));
      field.input.addEventListener('blur', () => {
        if (target.focused) target.focused = false;
      });
    };
    syncField(this.accountField, this.gui.accountField);
    syncField(this.passwordField, this.gui.passwordField);

    this.passwordField.eye.addEventListener('click', (event) => {
      event.preventDefault();
      this.gui.passwordField.revealed = !this.gui.passwordField.revealed;
      this.passwordField.input.focus();
    });

    this.loginBtn.addEventListener('mouseenter', () => {
      this.loginHovered = true;
      this.loginHoverAnim = BezierAnimation.createFloat(0, 1, 300, CP.CUBIC_OUT);
      this.loginHoverAnim.start();
    });
    this.loginBtn.addEventListener('mouseleave', () => {
      this.loginHovered = false;
      this.loginHoverAnim = BezierAnimation.createFloat(1, 0, 600, CP.CUBIC_OUT);
      this.loginHoverAnim.start();
    });
    this.loginBtn.addEventListener('click', () => {
      this.gui.submit();
    });

    // One-time password boxes.
    this.otpInputs.forEach((box, i) => {
      box.addEventListener('input', () => {
        const digits = box.value.replace(/[^0-9]/g, '');
        box.value = digits.slice(-1);
        this.gui.otp[i] = box.value;
        if (box.value && i < OTP_LENGTH - 1) this.otpInputs[i + 1].focus();
      });
      box.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !box.value && i > 0) {
          this.otpInputs[i - 1].focus();
        }
      });
      box.addEventListener('focus', () => {
        this.gui.otpIndex = i;
      });
    });
  }

  /** Applies one frame of GuiComponent state to the DOM. */
  sync() {
    const gui = this.gui;
    // Reuse the size BocchiApp already measured in resize() instead of forcing a
    // fresh layout here every frame.
    const k = (this.app.cssWidth || 1) / (viewport.scaledWidth || 1);
    const baseWidth = gui.loggedIn ? PROFILE.width : BASE_WIDTH;
    const baseHeight = gui.loggedIn ? PROFILE.height : PANEL_HEIGHT;

    this.root.style.left = `${gui.x * k}px`;
    this.root.style.top = `${gui.y * k}px`;
    this.root.style.width = `${gui.width * k}px`;
    this.root.style.height = `${gui.height * k}px`;

    const s = gui.cardScale * k;
    this.scale.style.width = `${baseWidth * DOM_SCALE}px`;
    this.scale.style.height = `${baseHeight * DOM_SCALE}px`;
    // The panel is authored at DOM_SCALE times the card units, so the transform
    // only has to make up the rest of the scale.
    this.scale.style.transform = `scale(${s / DOM_SCALE})`;

    this.loginView.classList.toggle('bp-hidden', gui.loggedIn);
    this.profileView.classList.toggle('bp-hidden', !gui.loggedIn);

    // Knob: vertical centre of the card, hidden on phones. Its geometry only
    // changes with the card height, so rebuild it only when that changes.
    const knobHidden = gui.isPhone;
    this.knob.style.display = knobHidden ? 'none' : '';
    if (!knobHidden && baseHeight !== this.knobBaseHeight) {
      this.knobBaseHeight = baseHeight;
      const h = baseHeight * 0.06;
      this.knobPoly.setAttribute('points', `-10,0 5,${h} 5,${-h}`);
      place(this.knob, -10, baseHeight / 2 - 10, 15, 20);
    }

    // Login form live state.
    this.accountField.wrap.classList.toggle('is-focused', gui.accountField.focused);
    this.accountField.wrap.classList.toggle('is-error', gui.loginError);
    this.passwordField.wrap.classList.toggle('is-focused', gui.passwordField.focused);
    this.passwordField.wrap.classList.toggle('is-error', gui.loginError);
    if (this.passwordField.input.type !== (gui.passwordField.revealed ? 'text' : 'password')) {
      this.passwordField.input.type = gui.passwordField.revealed ? 'text' : 'password';
      this.passwordField.eye.innerHTML = '';
      this.passwordField.eye.appendChild(eyeSvg(gui.passwordField.revealed));
    }
    this.passwordField.eye.classList.toggle('is-revealed', gui.passwordField.revealed);

    // Remember-me box: rebuild the tick only when the checked state changes.
    const checked = gui.remember.checked;
    if (checked !== this.rememberChecked) {
      this.rememberChecked = checked;
      this.remember.box.style.background = checked ? '#353535' : '#ffffff';
      this.remember.box.style.border = checked ? 'none' : '0.5px solid #353535';
      this.remember.box.innerHTML = '';
      if (checked) this.remember.box.appendChild(checkboxTickSvg());
    }

    // Login button hover animation.
    this.loginHoverAnim.update();
    const hover = this.loginHoverAnim.currentValue;
    const btnCardSize = mlerp(hover, 9.5, 10.5);
    this.loginBtn.style.background = cssColor(lerpColor(0xff353535, 0xfffba0be, hover));
    this.loginBtn.style.borderRadius = `${mlerp(hover, 3.5, 5.5)}px`;
    applyText(this.loginText, 'SH_BOLD', btnCardSize, 0xffffffff);
    this.loginText.style.lineHeight = '1';

    // Profile live state.
    if (gui.loggedIn) {
      const cx = PROFILE.width / 2;
      const name = `Hi ${gui.username}`;
      const nameW = textWidth('SH_BOLD', PROFILE.nameSize, name);
      this.nameText.textContent = name;
      place(this.nameText, cx - nameW / 2, PROFILE.nameTop);

      // Keep the boxes in step with the model: login / logout reset gui.otp, so
      // the digits must be cleared from the DOM too.
      for (let i = 0; i < this.otpInputs.length; i++) {
        const value = gui.otp[i] ?? '';
        if (this.otpInputs[i].value !== value) this.otpInputs[i].value = value;
      }
    }
  }

  destroy() {
    this.root.remove();
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }
}
