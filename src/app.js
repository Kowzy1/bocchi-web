// Application shell: owns the canvas, the MC-style GUI scale, the splash ->
// main menu state machine and the render loop.
//
// Everything the mod draws is measured in GUI units, so the canvas backing store
// plays the role of the Minecraft framebuffer: its size is CSS pixels times the
// device pixel ratio, the GUI scale is derived from it exactly like
// Window#calculateScale, and the canvas transform is that scale.

import { Gfx } from './engine/gfx.js';
import { viewport } from './engine/frame.js';
import { Assets, loadAssets } from './engine/assets.js';
import { clamp } from './engine/color.js';
import { now, setVirtualTime, clearVirtualTime } from './engine/time.js';
import { MainMenuMisayosScreen } from './ui/misayos/screen.js';
import { DomLoginPanel } from './ui/misayos/guiDom.js';
import { SplashUI } from './ui/splash/splash.js';

const FONT_FAMILIES = [
  'Bocchi SH Light',
  'Bocchi SH Regular',
  'Bocchi SH Heavy',
  'Bocchi SH Normal',
  'Bocchi SH Bold',
  'Bocchi Radikal',
];

/** Window#calculateScale for the "auto" GUI scale. */
export function calculateGuiScale(deviceWidth, deviceHeight) {
  let i = 1;
  while (
    i < 4 &&
    Math.floor(deviceWidth / (i + 1)) >= 320 &&
    Math.floor(deviceHeight / (i + 1)) >= 240
  ) {
    i++;
  }
  return i;
}

function readOptions() {
  const params = new URLSearchParams(window.location.search);
  const number = (name, fallback) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    stage: params.get('stage') === 'menu' ? 'menu' : 'splash',
    guiScale: params.has('guiScale') ? number('guiScale', 0) : 0,
    at: params.has('at') ? number('at', 0) : null,
    clickAt: params.has('click') ? number('click', 0) : null,
    panel: params.get('panel') === '1',
    loadDuration: number('load', 1200),
  };
}

export class BocchiApp {
  constructor(canvas) {
    this.canvas = canvas;
    this.gfx = new Gfx(canvas);
    this.options = readOptions();
    this.mouseGuiX = 0;
    this.mouseGuiY = 0;
    this.devicePixelRatio = 1;
    // CSS size of the canvas, refreshed by resize() and reused by the DOM panel
    // so it does not have to re-measure the canvas every frame.
    this.cssWidth = 1;
    this.cssHeight = 1;

    this.menu = null;
    this.splash = null;
    this.domPanel = null;

    this.actualProgress = 0;
    this.currentProgress = 0;
    this.fadeOutStart = null;
    this.splashStart = 0;
    this.frameHandle = 0;
    this.running = false;
    this.step = 1000 / 60;
    this.simTime = 0;
    this.splashProgress = 0;
    this.splashFade = -1;

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.loop = this.loop.bind(this);
  }

  async start() {
    if (this.options.at !== null) {
      // Deterministic capture: freeze the clock at 0 so every animation starts
      // there, then evaluate at `at` once the scene is built.
      setVirtualTime(0);
    }
    await loadAssets();
    await Promise.all(FONT_FAMILIES.map((family) => document.fonts.load(`53px "${family}"`)));

    // The splash caches its logo position from the viewport at construction
    // time (exactly like the Java SplashUI constructor), so the viewport has to
    // be measured before any screen object exists.
    this.resize();

    if (this.options.at !== null) {
      this.splashStart = 0;
    } else {
      this.splashStart = now();
    }

    if (this.options.stage === 'splash') {
      this.splash = new SplashUI();
    } else {
      this.showMenu();
    }

    this.running = true;

    if (this.options.at !== null) {
      // Headless capture: replay the timeline synchronously instead of relying
      // on the browser's frame clock, so the result is byte-for-byte stable.
      setTimeout(() => this.captureTimeline(this.options.at), 0);
      return;
    }

    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  /** Runs the state machine frame by frame from 0 to `at` and leaves that frame on screen. */
  captureTimeline(at) {
    // The DOM overlay only needs the final frame; syncing it every step would
    // be needless work while replaying the timeline synchronously.
    this.suppressDom = true;
    for (let t = 0; t < at; t += this.step) {
      setVirtualTime(t);
      this.resize();
      this.render();
    }
    setVirtualTime(at);
    this.resize();
    this.suppressDom = false;
    this.render();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    clearVirtualTime();
    if (this.domPanel) {
      this.domPanel.destroy();
      this.domPanel = null;
    }
  }

  showMenu() {
    if (this.menu) return;
    this.menu = new MainMenuMisayosScreen();
    if (this.options.panel) this.menu.gui.forceExpand = true;
    // The login panel is a DOM subtree; the canvas only draws the backdrop.
    this.domPanel = new DomLoginPanel(this.menu.gui, this);
  }

  /** SplashUI#onBeginFadeOut plus the screen swap from MixinSplashOverlay. */
  fadeOut() {
    if (!this.splash) return;
    this.splash.waitingForInput = false;
    this.splash.onBeginFadeOut();
    this.showMenu();
    if (this.options.panel) this.menu.gui.forceExpand = true;
  }

  /** Pointer position in GUI units, or null when the canvas is not measured. */
  pointerGui(event) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.devicePixelRatio;
    const deviceWidth = this.canvas.width;
    const deviceHeight = this.canvas.height;
    if (!deviceWidth || !deviceHeight) return null;
    return {
      x: Math.trunc(((event.clientX - rect.left) * dpr * viewport.scaledWidth) / deviceWidth),
      y: Math.trunc(((event.clientY - rect.top) * dpr * viewport.scaledHeight) / deviceHeight),
    };
  }

  onPointerDown(event) {
    if (this.splash && this.splash.waitingForInput) this.fadeOut();
  }

  onPointerMove(event) {
    const pointer = this.pointerGui(event);
    if (!pointer) return;
    this.mouseGuiX = pointer.x;
    this.mouseGuiY = pointer.y;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    this.devicePixelRatio = dpr;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;

    const deviceWidth = Math.max(1, Math.round(cssWidth * dpr));
    const deviceHeight = Math.max(1, Math.round(cssHeight * dpr));
    const scale =
      this.options.guiScale > 0
        ? this.options.guiScale
        : calculateGuiScale(deviceWidth, deviceHeight);

    this.gfx.setSize(deviceWidth, deviceHeight, scale);
    viewport.scaledWidth = Math.ceil(deviceWidth / scale);
    viewport.scaledHeight = Math.ceil(deviceHeight / scale);
    this.scale = scale;
  }

  /** Mirrors the LoadingOverlay drive logic in MixinSplashOverlay. */
  tick(t) {
    if (!this.splash) return;

    const loadDone = t - this.splashStart >= this.options.loadDuration;
    this.actualProgress = loadDone
      ? 1
      : clamp((t - this.splashStart) / this.options.loadDuration, 0, 1);
    this.currentProgress = clamp(this.currentProgress * 0.95 + this.actualProgress * 0.05, 0, 1);
    if (this.fadeOutStart === null && loadDone) {
      this.fadeOutStart = this.splashStart + this.options.loadDuration;
    }

    const f = this.fadeOutStart !== null ? (t - this.fadeOutStart) / 1000 : -1;

    if (Math.round(this.currentProgress) >= 1 && f > 2 && this.splash.isOkToFadeOut()) {
      this.splash.onOKToFadeOut();
    }

    if (this.options.clickAt !== null && t - this.splashStart >= this.options.clickAt) {
      if (this.splash.waitingForInput) this.fadeOut();
    }

    this.splashProgress = f < 1 && f < this.currentProgress ? f : this.currentProgress;
    this.splashFade = f;
    if (this.splash.isEnded()) this.splash = null;
  }

  render() {
    const gfx = this.gfx;
    const t = now();
    this.tick(t);

    gfx.begin();
    if (this.menu) this.menu.render(gfx, this.mouseGuiX, this.mouseGuiY);
    if (this.domPanel && !this.suppressDom) this.domPanel.sync();
    if (this.splash) {
      this.splash.render(gfx);
      this.splash.renderProgress(gfx, this.splashProgress ?? 0, this.splashFade ?? -1);
    }
  }

  loop() {
    if (!this.running) return;
    this.resize();

    if (this.options.at !== null) {
      // Deterministic capture: replay the timeline in fixed 60 Hz steps up to
      // the requested instant, then stop on the frame that lands exactly there.
      setVirtualTime(this.simTime);
      this.render();
      if (this.simTime >= this.options.at) {
        this.running = false;
        return;
      }
      this.simTime = Math.min(this.simTime + this.step, this.options.at);
    } else {
      this.render();
    }

    this.frameHandle = requestAnimationFrame(this.loop);
  }
}
