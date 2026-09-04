# Kodak Mini Camera — Desktop App Design

**Date:** 2026-09-03
**Status:** Approved, in build

## Goal
An Electron desktop app that renders a yellow Kodak-mini-camera face
(matching `interface_reference.webp`). The mini screen shows a live
webcam feed with a retro Kodak filter. Pressing the on-screen play
button (the shutter) captures a filtered photo to
`~/Pictures/KodakMini/`. Arrow buttons scroll through captured photos
in a review mode.

## Controls
- **Two round top buttons** — decorative, no function.
- **▶ play button** — shutter. Captures the current filtered frame,
  triggers a white flash + shutter-click sound, saves the photo.
- **▲ / ▼ arrows** — enter review mode and step through saved photos.
  Pressing the shutter returns to live view.
- **Keyboard:** Spacebar = shutter, ↑/↓ = review, Esc/Space returns to live.

## Screen modes
- **Live** (default): retro-filtered webcam preview.
- **Review**: shows saved photos, newest first; ▲/▼ navigate.

## Retro filter
Applied in real time on the canvas so preview and saved photo match:
warm tint (sepia), boosted contrast/saturation, vignette, light grain.
Filter is baked into the pixel data used for saving.

## Architecture
- **Main process** (`main.js`): creates a fixed-size window; exposes an
  IPC `save-photo` handler that writes a base64 JPEG to
  `~/Pictures/KodakMini/kodak_YYYY-MM-DD_HH-MM-SS.jpg` and returns the path.
- **Preload** (`preload.js`): `contextBridge` exposing `savePhoto(dataUrl)`.
- **Renderer** (`index.html`, `styles.css`, `renderer.js`): camera-body
  CSS art, webcam capture, filter render loop, mode/interaction logic.
- **Pure helpers** (`lib/`): filename timestamp + center-crop math, unit-tested.

## Data flow
1. Launch → `getUserMedia` → hidden `<video>`.
2. rAF loop draws center-cropped video into the screen `<canvas>` with
   the retro filter + vignette + grain.
3. Shutter → flash + sound → copy canvas → JPEG dataURL → IPC save →
   push path into in-memory photo list.
4. Arrows → review mode over the photo list.

## Testing
- Unit tests for filename + crop helpers.
- Manual verification by launching on macOS: preview + filter visible,
  shutter saves a real file and fires flash/sound, arrows scroll shots,
  shutter returns to live.
