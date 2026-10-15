// Shared layout constants for the right-hand login panel.
//
// Extracted from guiComponent.js so the canvas renderer and the DOM renderer
// (guiDom.js) agree on every measurement. All values are in "card units": the
// panel is drawn at `cardScale` times these units, exactly as the Java code did.

import { viewport } from '../../engine/frame.js';

/** Left inset and width of the form column inside the panel. */
export const FORM_X = 10;
export const FORM_WIDTH = 80;
/** Vertical offsets of the form rows, relative to the form's start. */
export const FORM_LABEL_1 = 0;
export const FORM_FIELD_1 = 6;
export const FORM_LABEL_2 = 28;
export const FORM_FIELD_2 = 34;
export const FORM_REMEMBER = 56;
export const FORM_LOGIN = 70;
export const FORM_FIELD_HEIGHT = 16;
export const FORM_REMEMBER_SIZE = 7;
/** Height of the form block, from the first label to the bottom of the button. */
export const FORM_BLOCK_HEIGHT = FORM_LOGIN + FORM_FIELD_HEIGHT;
/** The "Login" title occupies the top of the card. */
export const HEADER_BOTTOM = 27;
export const FORM_TOP_GAP = 11;
export const FORM_BOTTOM_MARGIN = 16;
/** The card hugs its content, so it keeps the same shape at every GUI scale. */
export const PANEL_HEIGHT = HEADER_BOTTOM + FORM_TOP_GAP + FORM_BLOCK_HEIGHT + FORM_BOTTOM_MARGIN;
/** Base card width; the whole card is drawn at `cardScale` times these units. */
export const BASE_WIDTH = 95;
export const MIN_CARD_SCALE = 0.6;

/** Demo credentials accepted by the login form. */
export const DEMO_USER = 'admin';
export const DEMO_PASSWORD = '123456';

/**
 * Signed-in "one-time password" view. Its own (wider) card so the content gets
 * the same breathing room as the login form; all values are in this card's units.
 */
export const PROFILE = {
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
export const OTP_LENGTH = 6;

export const COLOR_INK = 0xff2b2b2b;
export const COLOR_PINK = 0xffe0397a;
export const COLOR_BLUE = 0xff3b7bf6;
export const COLOR_MUTED = 0xff8a8a8a;
export const COLOR_HAIRLINE = 0xffd8d8d8;

/**
 * Responsive card scale. The card keeps a fixed shape in GUI units, but its
 * physical size is chosen per device class (phone / tablet / desktop) so it
 * reads well on a phone and is not lost on a large desktop window.
 */
export function computeCardScale(isPhone, baseWidth = BASE_WIDTH, baseHeight = PANEL_HEIGHT) {
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
