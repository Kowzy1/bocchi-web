// The Java code drives every animation from System.currentTimeMillis().
// The web port keeps the same shape but routes it through here, which lets a
// single deterministic frame be rendered for screenshots (`?at=<ms>`).

let virtual = null;

/** Freeze the clock at `ms`. Everything created afterwards stamps that time. */
export function setVirtualTime(ms) {
  virtual = ms;
}

export function clearVirtualTime() {
  virtual = null;
}

export function now() {
  return virtual === null ? performance.now() : virtual;
}
