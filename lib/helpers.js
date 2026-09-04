'use strict';

/**
 * Build the photo filename for a given Date.
 * Format: kodak_YYYY-MM-DD_HH-MM-SS.jpg (local time, zero-padded).
 * @param {Date} date
 * @returns {string}
 */
function photoFilename(date) {
  const p = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const mo = p(date.getMonth() + 1);
  const d = p(date.getDate());
  const h = p(date.getHours());
  const mi = p(date.getMinutes());
  const s = p(date.getSeconds());
  return `kodak_${y}-${mo}-${d}_${h}-${mi}-${s}.jpg`;
}

/**
 * Compute a centered source rectangle that crops `srcW x srcH` to the
 * target aspect ratio `targetW / targetH`, keeping as much of the frame
 * as possible (no letterboxing, no distortion).
 * @returns {{sx:number, sy:number, sWidth:number, sHeight:number}}
 */
function centerCropRect(srcW, srcH, targetW, targetH) {
  if (srcW <= 0 || srcH <= 0 || targetW <= 0 || targetH <= 0) {
    return { sx: 0, sy: 0, sWidth: srcW, sHeight: srcH };
  }
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  let sWidth;
  let sHeight;
  if (srcAspect > targetAspect) {
    // Source is wider than target: crop the sides.
    sHeight = srcH;
    sWidth = srcH * targetAspect;
  } else {
    // Source is taller than target: crop top/bottom.
    sWidth = srcW;
    sHeight = srcW / targetAspect;
  }
  const sx = (srcW - sWidth) / 2;
  const sy = (srcH - sHeight) / 2;
  return { sx, sy, sWidth, sHeight };
}

module.exports = { photoFilename, centerCropRect };
