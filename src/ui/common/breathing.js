// Port of me.baier.client.ui.api.BreathingUtil -- a cosine ease between two
// values with a fixed period.

import { now } from '../../engine/time.js';

export class BreathingUtil {
  constructor(durationMillis, minValue, maxValue) {
    if (minValue > maxValue) {
      const temp = minValue;
      minValue = maxValue;
      maxValue = temp;
    }
    this.durationMillis = durationMillis;
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.startTimeMillis = now();
  }

  getCurrentValue() {
    const elapsed = now() - this.startTimeMillis;
    if (this.minValue === this.maxValue) return this.minValue;
    const cyclePosition = (elapsed % this.durationMillis) / this.durationMillis;
    const normalized = (-Math.cos(cyclePosition * 2 * Math.PI) + 1) / 2;
    return this.minValue + normalized * (this.maxValue - this.minValue);
  }
}
