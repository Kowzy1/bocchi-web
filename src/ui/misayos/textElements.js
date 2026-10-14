// Port of me.baier.client.ui.mainmenu.misayos.TextElementsComponent.

import { BezierAnimation, CP } from '../../engine/bezier.js';
import { FontSet } from '../../engine/font.js';
import { cssColor, mlerp, replaceAlpha } from '../../engine/color.js';
import { BaseComponent } from './base.js';
import { drawTextBox } from '../common/renderUtils.js';

export class TextElementsComponent extends BaseComponent {
  initAnimations(frame, lastAnimation) {
    this.mainTextBlockAnim = BezierAnimation.createFloat(0, 1, 700, CP.CUBIC_OUT);
    this.infoTextAnim = BezierAnimation.createFloat(0, 1, 700, CP.CUBIC_OUT);
    this.lineAnim = BezierAnimation.createFloat(0, 1, 700, CP.CUBIC_OUT);
    this.decorateAnim = BezierAnimation.createFloat(0, 1, 700, CP.CUBIC_OUT);
    lastAnimation.then(this.mainTextBlockAnim, 0.05);
    this.mainTextBlockAnim.then(this.infoTextAnim, 0.05);
    this.infoTextAnim.then(this.lineAnim, 0.05);
    this.lineAnim.then(this.decorateAnim, 0.05);
    this.animations = [
      this.mainTextBlockAnim,
      this.infoTextAnim,
      this.lineAnim,
      this.decorateAnim,
    ];
    return this.decorateAnim;
  }

  render(gfx, frame) {
    const screenWidth = frame.scaledWidth;
    const blockPos1 = frame.block1Pos;
    const blockSize = frame.block1Size;
    const ctx = gfx.ctx;

    const infoFont = FontSet.SH_LIGHT.getFont(6.5);
    const decorateFont = FontSet.SH_REGULAR.getFont(8.5);
    const mainTextFont = FontSet.SH_HEAVY.getFont(53);
    const roundBoxFont = FontSet.SH_REGULAR.getFont(13);
    const textBoxFont = FontSet.SH_NORMAL.getFont(9.5);

    const infoTextValue = this.infoTextAnim.currentValue;
    const infoCurrentSpacing = mlerp(infoTextValue, 0.5, -0.15);
    const infoCurrentColor = replaceAlpha(0xffffffff, Math.round(mlerp(infoTextValue, 0, 255)));

    infoFont.drawString(
      gfx,
      'Goto, nicknamed "Little Solitude", ',
      blockPos1.x + blockSize * 0.15,
      blockSize * 0.05 - infoFont.getHalfHeight() / 2,
      infoCurrentColor,
      infoCurrentSpacing
    );
    infoFont.drawString(
      gfx,
      'is a girl who always starts her speech with "Ah..." ',
      blockPos1.x + blockSize * 0.15,
      blockSize * 0.05 - infoFont.getHalfHeight() / 2 + infoFont.getHeight() + 1,
      infoCurrentColor,
      mlerp(infoTextValue, 0.5, -0.15)
    );
    infoFont.drawString(
      gfx,
      'and is extremely accepting and introverted',
      blockPos1.x + blockSize * 0.15,
      blockSize * 0.05 - infoFont.getHalfHeight() / 2 + infoFont.getHeight() * 2 + 2,
      infoCurrentColor,
      infoCurrentSpacing
    );

    const lineValue = this.lineAnim.currentValue;
    const line1CurrentEndX = mlerp(lineValue, blockPos1.x, screenWidth * 0.55);
    const line2CurrentEndX = mlerp(lineValue, 0, blockPos1.x + blockSize * 0.735 + 4.5);

    ctx.save();
    ctx.strokeStyle = cssColor(0xffffffff);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(blockPos1.x, blockPos1.y);
    ctx.lineTo(line1CurrentEndX, blockPos1.y);
    ctx.moveTo(0, blockPos1.y + 5 - 0.2);
    ctx.lineTo(line2CurrentEndX, blockPos1.y + 5 - 0.2);
    ctx.stroke();
    ctx.restore();

    const rectWidth = blockSize * 0.6;
    const rectHeight = 5;
    gfx.drawRect(
      blockPos1.x - blockSize * 0.15,
      blockPos1.y - rectHeight,
      rectWidth,
      mlerp(lineValue, 0, rectHeight),
      0xffffffff
    );

    const decorateValue = this.decorateAnim.currentValue;
    const currentDecorateSpacing = mlerp(decorateValue, 0.5, 2.4);
    const currentDecorateColor = replaceAlpha(0xffffffff, Math.round(mlerp(decorateValue, 0, 255)));
    decorateFont.drawString(
      gfx,
      'SOCIAL  PHOBIA',
      blockPos1.x + blockSize * 0.04,
      blockPos1.y + 0.5,
      currentDecorateColor,
      currentDecorateSpacing
    );

    const bocchiTextFinalX = blockPos1.x - mainTextFont.getStringWidth('B') * 1.2;
    const bocchiTextFinalY = blockPos1.y + mainTextFont.getHeight() - 5;
    const bocchiTextWidth = mainTextFont.getStringWidth('BOCCHI', -1.5);

    const theRockFinalPosX = blockPos1.x - mainTextFont.getStringWidth('T') / 2;
    const theRockFinalPosY = blockPos1.y + mainTextFont.getHeight() * 2;
    const theRockTextWidth = mainTextFont.getStringWidth('THE ROCK!', -1.5);

    const gotohTextXArg =
      theRockFinalPosX +
      (mainTextFont.getStringWidth('THE RO', -1.5) + mainTextFont.getStringWidth('THE ROC', -1.5)) /
        2 -
      mainTextFont.getStringWidth('O') / 2;
    const gotohTextYArg = theRockFinalPosY + mainTextFont.getHeight() * 1.25;

    const reclusiveTextXArg = theRockFinalPosX + mainTextFont.getStringWidth('THE ROC', -1.5);
    const reclusiveTextYArg = theRockFinalPosY - mainTextFont.getHeight() / 4;

    const gotohContentWidth =
      roundBoxFont.getStringWidth('Gotoh Hitori') + -0.35 * 'Gotoh Hitori'.length;
    const gotohBoxRectX = gotohTextXArg - (gotohContentWidth * (1.3 - 1)) / 2;
    const gotohBoxRectY = gotohTextYArg - (roundBoxFont.getHeight() * (1.4 - 1)) / 2;
    const gotohBoxRectWidth = gotohContentWidth * 1.3;
    const gotohBoxRectHeight = roundBoxFont.getHeight() * 1.4;

    const reclusiveContentWidth =
      textBoxFont.getStringWidth('A reclusive girl') + -0.35 * 'A reclusive girl'.length;
    const reclusiveBoxRectX = reclusiveTextXArg - (reclusiveContentWidth * (1.1 - 1)) / 2;
    const reclusiveBoxRectY = reclusiveTextYArg - (textBoxFont.getHeight() * (1.8 - 1)) / 2;
    const reclusiveBoxRectWidth = reclusiveContentWidth * 1.1;
    const reclusiveBoxRectHeight = textBoxFont.getHeight() * 1.8;

    // The Java code mixes the *unhalved* Skia ascent/descent into screen space here.
    const ascent = mainTextFont.metricsAscent();
    const descent = mainTextFont.metricsDescent();

    const groupUntransformedMinX = Math.min(
      bocchiTextFinalX,
      Math.min(theRockFinalPosX, Math.min(gotohBoxRectX, reclusiveBoxRectX))
    );
    const groupUntransformedMinY = Math.min(
      bocchiTextFinalY + ascent,
      Math.min(theRockFinalPosY + ascent, Math.min(gotohBoxRectY, reclusiveBoxRectY))
    );
    const groupUntransformedMaxX = Math.max(
      bocchiTextFinalX + bocchiTextWidth,
      Math.max(
        theRockFinalPosX + theRockTextWidth,
        Math.max(gotohBoxRectX + gotohBoxRectWidth, reclusiveBoxRectX + reclusiveBoxRectWidth)
      )
    );
    const groupUntransformedMaxY = Math.max(
      bocchiTextFinalY + descent,
      Math.max(
        theRockFinalPosY + descent,
        Math.max(gotohBoxRectY + gotohBoxRectHeight, reclusiveBoxRectY + reclusiveBoxRectHeight)
      )
    );

    const groupFinalWidth = groupUntransformedMaxX - groupUntransformedMinX;
    const groupFinalHeight = groupUntransformedMaxY - groupUntransformedMinY;

    const animOffset = 50;
    const currentAnimValue = this.mainTextBlockAnim.currentValue;
    const groupCurrentX = mlerp(
      currentAnimValue,
      groupUntransformedMinX,
      groupUntransformedMinX
    );
    const groupCurrentY = mlerp(
      currentAnimValue,
      groupUntransformedMinY + animOffset * 2,
      groupUntransformedMinY
    );
    const groupCurrentAlpha = Math.round(currentAnimValue * 255);

    gfx.save();
    gfx.translate(
      groupCurrentX - groupUntransformedMinX,
      groupCurrentY - groupUntransformedMinY
    );
    gfx.pushLayer(null, { alpha: groupCurrentAlpha });

    const scalePivotX = groupUntransformedMinX + groupFinalWidth / 2;
    const scalePivotY = groupUntransformedMinY + groupFinalHeight / 2;
    const currentScale = mlerp(currentAnimValue, 0.85, 1);
    gfx.translate(scalePivotX, scalePivotY);
    gfx.scaleBy(currentScale, currentScale);
    gfx.translate(-scalePivotX, -scalePivotY);

    mainTextFont.drawString(gfx, 'BOCCHI', bocchiTextFinalX, bocchiTextFinalY, 0xffffffff, -1.5);
    mainTextFont.drawString(
      gfx,
      'THE ROCK!',
      theRockFinalPosX,
      theRockFinalPosY,
      0xffffffff,
      -1.5
    );
    drawTextBox(
      gfx,
      roundBoxFont,
      'Gotoh Hitori',
      gotohTextXArg,
      gotohTextYArg,
      0xffffffff,
      0xff000000,
      -0.35,
      1.3,
      1.4,
      4
    );
    drawTextBox(
      gfx,
      textBoxFont,
      'A reclusive girl',
      reclusiveTextXArg,
      reclusiveTextYArg,
      0xffffffff,
      0xff000000,
      -0.35,
      1.1,
      1.8,
      0
    );

    gfx.popLayer();
    gfx.restore();
  }
}
