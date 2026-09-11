'use strict';

// ----- center-crop helper (mirrors lib/helpers.js, inlined for the renderer) -----
function centerCropRect(srcW, srcH, targetW, targetH) {
  if (srcW <= 0 || srcH <= 0 || targetW <= 0 || targetH <= 0) {
    return { sx: 0, sy: 0, sWidth: srcW, sHeight: srcH };
  }
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;
  let sWidth, sHeight;
  if (srcAspect > targetAspect) {
    sHeight = srcH;
    sWidth = srcH * targetAspect;
  } else {
    sWidth = srcW;
    sHeight = srcW / targetAspect;
  }
  return { sx: (srcW - sWidth) / 2, sy: (srcH - sHeight) / 2, sWidth, sHeight };
}

// ----- DOM refs -----
const canvas = document.getElementById('screen-canvas');
const ctx = canvas.getContext('2d');
const reviewImg = document.getElementById('review-img');
const flashEl = document.getElementById('flash');
const statusEl = document.getElementById('status');
const badgeEl = document.getElementById('badge');
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnShutter = document.getElementById('btn-shutter');
const btnDelete = document.getElementById('btn-delete');
const btnExit = document.getElementById('btn-exit');
const keychain = document.getElementById('keychain');
const flipCard = document.getElementById('flip-card');

const W = canvas.width;
const H = canvas.height;

// ----- state -----
const video = document.createElement('video');
video.muted = true;
video.playsInline = true;

let streamReady = false;
let face = 'front'; // 'front' | 'back' — which side of the camera is showing
let mode = 'live'; // 'live' | 'review'
const photos = []; // { dataUrl } newest last
let reviewIndex = 0;

// ----- retro grain tile (regenerated occasionally for a living film look) -----
const grain = document.createElement('canvas');
grain.width = 256;
grain.height = 256;
const grainCtx = grain.getContext('2d');
function regenGrain() {
  const img = grainCtx.createImageData(grain.width, grain.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 110 + Math.random() * 90;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  grainCtx.putImageData(img, 0, 0);
}
regenGrain();
let grainFrame = 0;

// ----- the retro Kodak render -----
function renderFrame() {
  if (streamReady && mode === 'live' && video.readyState >= 2) {
    const { sx, sy, sWidth, sHeight } = centerCropRect(
      video.videoWidth, video.videoHeight, W, H
    );

    // filtered, mirrored webcam frame
    ctx.save();
    ctx.filter = 'sepia(0.32) saturate(1.35) contrast(1.08) brightness(1.05)';
    ctx.translate(W, 0);
    ctx.scale(-1, 1); // mirror like a selfie
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, W, H);
    ctx.restore();

    // warm color wash
    ctx.fillStyle = 'rgba(255, 176, 74, 0.06)';
    ctx.fillRect(0, 0, W, H);

    // vignette
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, W * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // film grain (shifted each frame, refreshed periodically)
    grainFrame++;
    if (grainFrame % 6 === 0) regenGrain();
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    const ox = -Math.random() * 256;
    const oy = -Math.random() * 256;
    for (let x = ox; x < W; x += 256) {
      for (let y = oy; y < H; y += 256) {
        ctx.drawImage(grain, x, y);
      }
    }
    ctx.restore();
  }
  requestAnimationFrame(renderFrame);
}

// ----- shutter sound (WebAudio, synthesized "cha-chunk") -----
let audioCtx = null;
function shutterSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    // mechanical click: two short filtered-noise bursts
    const burst = (t, freq, gain, dur) => {
      const len = Math.floor(audioCtx.sampleRate * dur);
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 0.8;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp).connect(g).connect(audioCtx.destination);
      src.start(t);
      src.stop(t + dur);
    };
    burst(now, 2600, 0.5, 0.05);          // "cha"
    burst(now + 0.07, 1400, 0.4, 0.09);   // "chunk"
  } catch (_) { /* audio not critical */ }
}

// ----- capture -----
async function takePhoto() {
  if (mode !== 'live' || !streamReady) {
    // if reviewing, shutter returns to live
    if (mode === 'review') showLive();
    return;
  }
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // flash + sound
  flashEl.classList.remove('fire');
  void flashEl.offsetWidth; // restart animation
  flashEl.classList.add('fire');
  shutterSound();

  const photo = { dataUrl, path: null };
  photos.push(photo);

  try {
    if (window.kodak && window.kodak.savePhoto) {
      photo.path = await window.kodak.savePhoto(dataUrl);
      flashBadge('Saved ✓');
      console.log('saved photo:', photo.path);
    }
  } catch (err) {
    console.error('save failed:', err);
    flashBadge('Save failed');
  }
}

// ----- modes -----
function updateBadge() {
  if (mode === 'live') {
    badgeEl.hidden = false;
    badgeEl.className = 'badge live';
    badgeEl.textContent = 'LIVE';
  } else {
    badgeEl.hidden = false;
    badgeEl.className = 'badge';
    badgeEl.textContent = `${reviewIndex + 1} / ${photos.length}`;
  }
}

let badgeTimer = null;
function flashBadge(text) {
  const prevMode = mode;
  badgeEl.hidden = false;
  badgeEl.className = 'badge';
  badgeEl.textContent = text;
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => { if (prevMode === mode) updateBadge(); }, 1100);
}

function showLive() {
  mode = 'live';
  reviewImg.hidden = true;
  btnDelete.classList.add('dim'); // visible but inactive in live view
  updateBadge();
}

function showReview() {
  if (photos.length === 0) {
    flashBadge('No photos yet');
    return;
  }
  mode = 'review';
  reviewImg.hidden = false;
  btnDelete.classList.remove('dim');
  reviewImg.src = photos[reviewIndex].dataUrl;
  updateBadge();
}

// Move the currently-previewed photo to the Trash and drop it from the reel.
async function deleteCurrent() {
  if (mode !== 'review') {
    flashBadge('Press ▲/▼ to review first');
    return;
  }
  if (photos.length === 0) return;
  const photo = photos[reviewIndex];
  try {
    if (photo.path && window.kodak && window.kodak.deletePhoto) {
      await window.kodak.deletePhoto(photo.path);
    }
  } catch (err) {
    console.error('delete failed:', err);
    flashBadge('Delete failed');
    return;
  }
  photos.splice(reviewIndex, 1);
  if (photos.length === 0) {
    showLive();
    flashBadge('Deleted');
    return;
  }
  if (reviewIndex >= photos.length) reviewIndex = photos.length - 1;
  reviewImg.src = photos[reviewIndex].dataUrl;
  flashBadge('Deleted');
}

function step(delta) {
  if (mode !== 'review') {
    // entering review from live: start at the newest photo
    if (photos.length === 0) { flashBadge('No photos yet'); return; }
    reviewIndex = photos.length - 1;
    showReview();
    return;
  }
  reviewIndex = (reviewIndex + delta + photos.length) % photos.length;
  reviewImg.src = photos[reviewIndex].dataUrl;
  updateBadge();
}

// ----- wiring -----
btnShutter.addEventListener('click', takePhoto);
btnUp.addEventListener('click', () => step(-1));   // ▲ = previous (older)
btnDown.addEventListener('click', () => step(1));  // ▼ = next (newer)
btnDelete.addEventListener('click', deleteCurrent);
btnExit.addEventListener('click', () => {
  if (window.kodak && window.kodak.quit) window.kodak.quit();
});
keychain.addEventListener('click', () => {
  if (window.kodak && window.kodak.openFolder) window.kodak.openFolder();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); takePhoto(); }
  else if (e.code === 'ArrowUp') { e.preventDefault(); step(-1); }
  else if (e.code === 'ArrowDown') { e.preventDefault(); step(1); }
  else if ((e.code === 'Backspace' || e.code === 'Delete') && mode === 'review') {
    e.preventDefault();
    deleteCurrent();
  }
  else if (e.code === 'Escape' && mode === 'review') { showLive(); }
  else if (e.key === 'o' || e.key === 'O') {
    if (window.kodak && window.kodak.openFolder) window.kodak.openFolder();
  }
});

// ----- start camera -----
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    streamReady = true;
    statusEl.hidden = true;
    showLive();
    console.log(`camera ready: ${video.videoWidth}x${video.videoHeight}`);
  } catch (err) {
    console.error('camera error:', err);
    statusEl.hidden = false;
    statusEl.textContent =
      'Camera unavailable.\nGrant camera access in System Settings → Privacy & Security → Camera, then reopen.';
  }
}

// Stop the webcam (turns the camera light off) when we flip to the front.
function stopCamera() {
  const stream = video.srcObject;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  streamReady = false;
}

// Start the webcam if it isn't already running (on flip to the back).
async function ensureCamera() {
  if (streamReady && video.srcObject) return;
  statusEl.hidden = false;
  statusEl.textContent = 'Starting camera…';
  await startCamera();
}

// ----- flip between front and back -----
function setFace(next) {
  if (next === face) return;
  face = next;
  if (face === 'back') {
    flipCard.classList.add('flipped');
    ensureCamera();
  } else {
    flipCard.classList.remove('flipped');
    stopCamera();
  }
}

function toggleFace() {
  setFace(face === 'front' ? 'back' : 'front');
}

// Double-click anywhere on the camera (but not on a control) flips it over.
flipCard.addEventListener('dblclick', (e) => {
  if (e.target.closest('.ctrl, .keychain')) return;
  toggleFace();
});

// ----- manual window dragging (frameless window has no title bar) -----
let dragging = false;
let dragMoved = false;
let dragStartX = 0;
let dragStartY = 0;
const DRAG_THRESHOLD = 3; // px before we treat it as a drag (not a click)

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('.ctrl, #keychain')) return; // don't drag from buttons
  dragging = true;
  dragMoved = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  if (window.kodak && window.kodak.dragStart) window.kodak.dragStart();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - dragStartX;
  const dy = e.screenY - dragStartY;
  if (!dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  dragMoved = true;
  if (window.kodak && window.kodak.dragMove) window.kodak.dragMove(dx, dy);
});
window.addEventListener('mouseup', () => { dragging = false; });

console.log('renderer booted');
requestAnimationFrame(renderFrame);
