# Bocchi Client — Launch UI (Web Replica)

**English** · [简体中文](README.zh-CN.md)

This is a web replica of the launch UI from [**baier233/bocchi-template-1.21.5**](https://github.com/baier233/bocchi-template-1.21.5),
a Minecraft mod built on Skija (Java bindings for Skia). It re-draws that screen in the browser:
a Canvas 2D context replays the same drawing commands, coordinate formulas, Bézier evaluation,
`saveLayer` semantics and font metrics, so it is not a look-alike rebuilt from screenshots.

It is a front-end replica only — no game logic, and nothing is injected into Minecraft.

One deliberate divergence: the mod's right-hand button column (single player / multiplayer / alt
manager / options) is replaced by a working demo **login panel** — account, password, remember-me,
a one-time-password step and a signed-in profile view. Unlike the rest of the screen it is built as
a **real DOM subtree** rather than painted on the canvas, so its elements can be inspected, copied
and edited like any other DOM. It keeps the original fonts, palette and hover animation, and the
account data never leaves the browser (see [Scope and known deviations](#scope-and-known-deviations)).

![Main menu](screenshots/menu.png)

| Splash — loading | Splash — TAP TO START |
| --- | --- |
| ![Splash loading](screenshots/splash-loading.png) | ![Splash tap to start](screenshots/splash-tap.png) |

| Splash → menu transition | Login panel |
| --- | --- |
| ![Transition](screenshots/transition.png) | ![Login panel](screenshots/menu-panel.png) |

| Signed in — one-time password |
| --- |
| ![Profile](screenshots/menu-profile.png) |

<sub>All screenshots are 1920×1080 (GUI scale 4). `screenshots/menu-720p.png` is the same menu at
1280×720 (GUI scale 3) and shows that the whole layout is driven by Minecraft's GUI scale.</sub>

---

## Quick start

```bash
pnpm install
pnpm dev            # dev server with HMR
pnpm run build      # production build -> dist/
pnpm preview        # preview the build with vite
```

Node 24 / pnpm 11 were used to develop this, and `pnpm-lock.yaml` is the authoritative lockfile.
If you prefer not to install anything, the build output can also be served by the dependency-free
helper in `tools/`:

```bash
node tools/serve.mjs dist 5173
```

Then open <http://localhost:5173/>. The default flow is the real one: the splash screen appears,
after ~3 s **TAP TO START** fades in, and clicking it fades the main menu in behind it.

## URL parameters

Every parameter is optional and exists so a single frame can be reproduced deterministically.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `?stage=menu` | `splash` | Skip the splash screen and go straight to the main menu. |
| `?at=<ms>` | – | Freeze the virtual clock at `<ms>`. The timeline is replayed in 1/60 s steps and then rendered once; the render loop is not started. |
| `?click=<ms>` | – | Simulate a click at `<ms>` (drives the splash → menu transition). |
| `?guiScale=<n>` | auto | Force the GUI scale. The default follows Minecraft's `Window#calculateScale`. |
| `?panel=1` | – | Force the right-hand panel open (normally it only opens on hover). |
| `?load=<ms>` | `1200` | Simulated loading duration before the fade-out begins. |

Examples:

```
/?at=3600                          # the "TAP TO START" frame
/?stage=menu&at=6000               # the fully settled main menu
/?stage=menu&at=6000&panel=1       # the menu with the panel expanded
/?at=4700&click=4000               # mid-transition between splash and menu
```

> `?at=` replays the timeline **synchronously**, so a large value blocks the main thread for a
> while at 1920×1080 (roughly 30 s in headless software rendering). It is a debugging and
> screenshot aid, not a feature.

## How the port works

The guiding rule was: **do not "fix" anything.** Where the original has an odd formula, the port
has the same odd formula, so the two produce the same pixels. (The login panel is the single,
deliberate exception: it is rendered as DOM instead of on the canvas — see
[Scope and known deviations](#scope-and-known-deviations).)

### GUI scale

The canvas backing store plays the role of the Minecraft framebuffer: it is `CSS pixels ×
devicePixelRatio`, the GUI scale is derived from it exactly like `Window#calculateScale`
(`i = 1; while (i < 4 && floor(w/(i+1)) >= 320 && floor(h/(i+1)) >= 240) i++`), and the canvas
transform is that scale. Everything below is then written in GUI units.

### Fonts and text metrics

`SkiaFontRenderer` scales the canvas by `0.5` before drawing, so a `size` passed in the Java code
is really rendered at `size / 2`. Line height comes from the font's `hhea` table
(`lineGap + ascent + descent` — none of the shipped fonts set OS/2 `USE_TYPO_METRICS`, so Skia
uses `hhea`), and advance widths come from `hmtx`.

Both are extracted ahead of time by `tools/gen-font-metrics.py` into `src/engine/metrics.js`, so
text width and line height are identical in every browser instead of depending on the platform's
font stack.

### Layers

Skia's `saveLayer` / `saveLayerAlpha` rasterise in device space and then composite with an alpha
and/or an image filter. `Gfx#pushLayer` / `popLayer` do the same with a pool of offscreen
canvases. This matters: the opening animation stacks a lot of translucent shapes, and plain
`globalAlpha` would darken every overlap instead of compositing the group as a whole.

### Blur and dilate

- `ImageFilter.makeBlur(sigma)` and CSS `blur()` mean the same thing, so a sigma is emitted as
  `blur(sigma * scale px)` — the sigma is a local (GUI) unit and gets scaled by the CTM.
- `ImageFilter.makeDilate(1, 1)` is a 3×3 maximum filter, i.e. the union of 9 shifted copies. It
  is baked into a single sprite once and drawn once, rather than drawn 9 times (which would raise
  the alpha where the copies overlap).

### Icons

SVG icons are rasterised offscreen at their target size and then filled with `source-in`, which is
the Canvas 2D equivalent of `ColorFilter.makeBlend(color, SRC_IN)`.

### Animation

`BezierAnimation` is ported including its 11-entry sample table, its Newton iteration and its
`then(next, triggerProgress)` chaining — including the small quirk in the original bisection
branch. The intro timeline therefore matches the game's.

### Deliberately preserved quirks

For example, `TextElementsComponent` positions the three lines of bio text with
`blockSize * 0.05 - halfHeight / 2`, which omits `block1Pos.y` (so they end up near the top of the
screen), and the `drawRectLTRB` in `BgRectsComponent` paints a lighter pink block above `block1`.
Both are reproduced as written.

## Project structure

```
.
├── index.html
├── vite.config.js
├── public/assets/            # textures, icons, fonts copied from the mod
├── screenshots/              # reference captures (see above)
├── tools/
│   ├── gen-font-metrics.py   # TTF -> src/engine/metrics.js
│   └── serve.mjs             # dependency-free static server
└── src/
    ├── main.js               # Vue entry
    ├── App.vue               # canvas host
    ├── style.css             # @font-face declarations + full-bleed canvas
    ├── app.js                # GUI scale, splash -> menu state machine, render loop
    ├── engine/               # Canvas 2D backend that mirrors the Skia calls
    │   ├── gfx.js            #   SkiaContext / SkiaRenderEngine + saveLayer
    │   ├── font.js           #   SkiaFontRenderer / FontSet
    │   ├── bezier.js         #   BezierAnimation / BezierControlPoints
    │   ├── color.js          #   ColorUtil / ARGB
    │   ├── assets.js         #   image loading, tinting, dilate
    │   ├── frame.js          #   *FrameContext (layout formulas)
    │   ├── metrics.js        #   generated font metrics
    │   └── time.js           #   virtual clock (for ?at=)
    └── ui/
        ├── common/           # album, logo renderer, text boxes, breathing
        ├── misayos/          # the main menu components + screen
        │   ├── guiComponent.js   # login-panel model (state + expand/blur animation)
        │   ├── guiDom.js         # the login panel, rendered as real DOM
        │   └── panelLayout.js    # shared card layout constants
        └── splash/           # SplashUI + LoadingAnimateRenderer
```

## Java → JS map

| Java (`common/src/main/java/`) | JS (`src/`) |
| --- | --- |
| `me.baier.graphics.SkiaContext` | `engine/gfx.js` |
| `me.baier.graphics.font.SkiaFontRenderer` / `FontSet` | `engine/font.js` |
| `me.baier.animation.BezierAnimation` / `BezierControlPoints` | `engine/bezier.js` |
| `me.baier.utils.ColorUtil` / `net.minecraft.util.ARGB` | `engine/color.js` |
| `me.baier.utils.RenderUtils` | `ui/common/renderUtils.js` |
| `me.baier.utils.ScreenUtils.calculateStartPosition` | `ui/misayos/mainTachie.js` |
| `me.baier.client.ui.model.*FrameContext` | `engine/frame.js` |
| `client.ui.common.components.AlbumRenderer` | `ui/common/album.js` |
| `client.ui.common.components.LogoRenderer` | `ui/common/logoRenderer.js` |
| `client.ui.mainmenu.common.LogoComponent` | `ui/misayos/logo.js` |
| `client.ui.mainmenu.misayos.BgRectsComponent` | `ui/misayos/bgRects.js` |
| `client.ui.mainmenu.misayos.StrokeElementsComponent` | `ui/misayos/strokeElements.js` |
| `client.ui.mainmenu.misayos.TextElementsComponent` | `ui/misayos/textElements.js` |
| `client.ui.mainmenu.misayos.MainTachieComponent` | `ui/misayos/mainTachie.js` |
| `client.ui.mainmenu.misayos.GuiComponent` (+ `childs/*`) | `ui/misayos/guiComponent.js` (model), `guiDom.js` (DOM renderer), `panelLayout.js` |
| `client.ui.mainmenu.misayos.MainMenuMisayosScreen` | `ui/misayos/screen.js` |
| `client.ui.splash.SplashUI` / `LoadingAnimateRenderer` | `ui/splash/splash.js` |
| `injection.mixins.transformers.MixinSplashOverlay` (timing) | `app.js`, `tick()` |

## Regenerating the font metrics

`src/engine/metrics.js` is generated from the TTFs in `public/assets/`. Re-run it if you swap a
font:

```bash
python tools/gen-font-metrics.py
```

It parses `head`, `hhea`, `hmtx` and `cmap` and writes the upem, hhea ascent/descent/lineGap and
per-character advance widths that the renderer needs.

## Scope and known deviations

- **Only the authored UI is drawn.** The vanilla `Screen.renderBackground` gradient overlay is not
  replicated; the Misayos screen paints its own opaque gradient, which is treated as the design.
- **The button column is a demo login panel, rendered as DOM.** The mod's single player /
  multiplayer / alt manager / options buttons are replaced with a working account / password form.
  Unlike the rest of the screen it is built from real DOM nodes (`ui/misayos/guiDom.js`) instead of
  canvas draw calls, so the elements can be inspected and copied; the canvas still draws the
  dim / blur / zoom backdrop behind it. It accepts the demo credentials `admin` / `123456` and leads
  to a signed-in view with a one-time-password step (logout / verification / manage-device links are
  present but inert). It is a self-contained front-end demo: the credentials are hard-coded and
  checked in the browser, and nothing is sent anywhere.
- **The video background is not implemented.** `BackgroundRenderer` / `default.mp4` is fully
  covered by the opaque gradient in this screen and is never visible in game.
- **The poulsen menu is not ported.** `poulsen/MainMenuScreen` is never instantiated in the mod
  (dead code), so `gotoh.png`, `gotoh_image_1.png` and `gotoh_image_2.png` are unused here.
- **`default.mp4` and `gotoh.png` are kept** in `public/assets/` for completeness even though
  nothing references them; they are the two large files in the repository.

## Credits and licensing

- The UI design, layout maths and all artwork originate from
  [**baier233/bocchi-template-1.21.5**](https://github.com/baier233/bocchi-template-1.21.5) and its
  author. This repository is an unaffiliated re-implementation of that mod's front end and reuses
  its assets; please credit the original project.
- *Bocchi the Rock!* and its characters are © Aki Hamaji / Houbunsha / CloverWorks.
- Bundled fonts remain under their own licenses: **Source Han Sans** (Adobe, SIL Open Font
  License 1.1) and **Radikal**. Check the Radikal license before redistributing this repository
  publicly — it may not permit redistribution.
- The re-implementation code in this repository is released under the [MIT License](LICENSE); that
  license covers only the code authored here. The reused artwork, characters and bundled fonts are
  not covered by it and remain under the licences of their respective owners listed above.
