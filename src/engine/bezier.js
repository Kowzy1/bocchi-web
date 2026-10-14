// Port of me.baier.animation.BezierAnimation / BezierControlPoints.
//
// Everything is kept identical to the Java implementation, including the
// sample table, the Newton iteration and the chained-animation trigger
// semantics, because the intro sequence depends on all of it.

import { now } from './time.js';

export class BezierControlPoints {
  constructor(p1x, p1y, p2x, p2y) {
    this.p1x = p1x;
    this.p1y = p1y;
    this.p2x = p2x;
    this.p2y = p2y;
  }

  key() {
    return `${this.p1x},${this.p1y},${this.p2x},${this.p2y}`;
  }
}

export const CP = {
  EASE_IN_OUT: new BezierControlPoints(0.42, 0, 0.58, 1),
  EASE_OUT: new BezierControlPoints(0, 0, 0.58, 1),
  EASE_IN: new BezierControlPoints(0.42, 0, 1, 1),
  LINEAR: new BezierControlPoints(0, 0, 1, 1),
  CIRC_IN: new BezierControlPoints(0.55, 0, 1, 0.45),
  CIRC_OUT: new BezierControlPoints(0, 0.55, 0.45, 1),
  CUBIC_IN: new BezierControlPoints(0.55, 0.055, 0.675, 0.19),
  CUBIC_OUT: new BezierControlPoints(0.215, 0.61, 0.355, 1),
  CUBIC_IN_OUT: new BezierControlPoints(0.645, 0.045, 0.355, 1),
};

const SAMPLE_SIZE = 11;
const NEWTON_MIN_SLOPE = 0.001;
const NEWTON_ITERATIONS = 8;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;

const SAMPLE_TABLES = new Map();

function calcBezier(t, a, b, c) {
  return ((a * t + b) * t + c) * t;
}

function getSlope(t, a, b, c) {
  return 3 * a * t * t + 2 * b * t + c;
}

function sampleTableFor(cp) {
  if (cp === CP.LINEAR || cp.key() === CP.LINEAR.key()) return null;
  const key = cp.key();
  let table = SAMPLE_TABLES.get(key);
  if (table) return table;
  table = new Float32Array(SAMPLE_SIZE);
  const cx = 3 * cp.p1x;
  const bx = 3 * (cp.p2x - cp.p1x) - cx;
  const ax = 1 - cx - bx;
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    table[i] = calcBezier(i * (1 / (SAMPLE_SIZE - 1)), ax, bx, cx);
  }
  SAMPLE_TABLES.set(key, table);
  return table;
}

export class BezierAnimation {
  constructor(initialValue, targetValue, duration, controlPoints) {
    this.startValue = initialValue;
    this.targetValue = targetValue;
    this.currentValue = initialValue;
    this.duration = duration <= 0 ? 1 : duration;
    this.controlPoints = controlPoints;

    const { p1x, p1y, p2x, p2y } = controlPoints;
    this.cx = 3 * p1x;
    this.bx = 3 * (p2x - p1x) - this.cx;
    this.ax = 1 - this.cx - this.bx;
    this.cy = 3 * p1y;
    this.by = 3 * (p2y - p1y) - this.cy;
    this.ay = 1 - this.cy - this.by;

    this.startTime = 0;
    this.isAnimating = false;
    this.isPaused = false;
    this.totalPausedTime = 0;
    this.progress = 0;
    this.chained = [];
    this.sampleTable = sampleTableFor(controlPoints);
  }

  static createFloat(initialValue, targetValue, duration, controlPoints) {
    return new BezierAnimation(initialValue, targetValue, duration, controlPoints);
  }

  /** Mirrors BezierAnimation#then(next, triggerProgress) */
  then(next, triggerProgress = 1) {
    this.chained.push({
      animation: next,
      triggerProgress: Math.max(0, Math.min(1, triggerProgress)),
      triggered: false,
    });
    return next;
  }

  getTForX(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (this.sampleTable === null) return x;

    let intervalStart = 0;
    let currentSample = 1;
    const lastSample = SAMPLE_SIZE - 1;
    while (currentSample !== lastSample && this.sampleTable[currentSample] <= x) {
      intervalStart += 1 / (SAMPLE_SIZE - 1);
      ++currentSample;
    }
    --currentSample;

    const dist =
      (x - this.sampleTable[currentSample]) /
      (this.sampleTable[currentSample + 1] - this.sampleTable[currentSample]);
    let guessForT = intervalStart + dist * (1 / (SAMPLE_SIZE - 1));
    const initialSlope = getSlope(guessForT, this.ax, this.bx, this.cx);

    if (initialSlope >= NEWTON_MIN_SLOPE) {
      for (let i = 0; i < NEWTON_ITERATIONS; i++) {
        const currentX = calcBezier(guessForT, this.ax, this.bx, this.cx) - x;
        if (Math.abs(currentX) < SUBDIVISION_PRECISION) return guessForT;
        const currentSlope = getSlope(guessForT, this.ax, this.bx, this.cx);
        if (Math.abs(currentSlope) < NEWTON_MIN_SLOPE) break;
        guessForT -= currentX / currentSlope;
      }
      return guessForT;
    } else if (initialSlope === 0) {
      return guessForT;
    }
    // The Java bisection branch assigns to the same bound in both directions;
    // it is reproduced verbatim so the port cannot drift from the original.
    const intervalStartA = intervalStart;
    let intervalEnd = intervalStart + 1 / (SAMPLE_SIZE - 1);
    let i = 0;
    for (;;) {
      guessForT = intervalStartA + (intervalEnd - intervalStartA) / 2;
      const currentX = calcBezier(guessForT, this.ax, this.bx, this.cx) - x;
      if (Math.abs(currentX) < SUBDIVISION_PRECISION) return guessForT;
      intervalEnd = guessForT;
      ++i;
      if (i === SUBDIVISION_MAX_ITERATIONS) return guessForT;
    }
  }

  start() {
    this.currentValue = this.startValue;
    this.startTime = now();
    this.totalPausedTime = 0;
    this.isAnimating = true;
    this.isPaused = false;
    for (const entry of this.chained) entry.triggered = false;
    return this;
  }

  /** BezierAnimation#set(value) */
  set(value) {
    if (this.isAnimating && !this.isPaused) this.update();
    this.startValue = this.currentValue;
    this.targetValue = value;
    this.progress = 0;
    this.startTime = now();
    this.isAnimating = true;
    this.isPaused = false;
    this.totalPausedTime = 0;
    for (const entry of this.chained) entry.triggered = false;
  }

  isComplete() {
    return this.progress >= 1;
  }

  checkChained() {
    for (const entry of this.chained) {
      if (!entry.triggered && this.progress >= entry.triggerProgress) {
        entry.animation.start();
        entry.triggered = true;
      }
    }
  }

  update() {
    if (!this.isAnimating || this.isPaused) return this.currentValue;

    const elapsed = now() - this.startTime - this.totalPausedTime;
    this.progress = Math.max(0, Math.min(1, elapsed / this.duration));

    const t = this.getTForX(this.progress);
    const y = calcBezier(t, this.ay, this.by, this.cy);
    this.currentValue = this.startValue + (this.targetValue - this.startValue) * y;

    this.checkChained();

    if (this.progress >= 1) this.isAnimating = false;
    return this.currentValue;
  }
}
