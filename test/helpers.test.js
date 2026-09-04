'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { photoFilename, centerCropRect } = require('../lib/helpers');

test('photoFilename formats local time with zero-padding', () => {
  // Local time constructor: Jan 5 2026, 09:03:07
  const d = new Date(2026, 0, 5, 9, 3, 7);
  assert.strictEqual(photoFilename(d), 'kodak_2026-01-05_09-03-07.jpg');
});

test('photoFilename pads double-digit values correctly', () => {
  const d = new Date(2026, 10, 23, 14, 22, 5);
  assert.strictEqual(photoFilename(d), 'kodak_2026-11-23_14-22-05.jpg');
});

test('centerCropRect crops sides when source is wider than target', () => {
  // 21:9 source (2100x900, aspect 2.333) cropped to 16:9 target (1.777)
  const r = centerCropRect(2100, 900, 16, 9);
  assert.strictEqual(r.sHeight, 900);
  assert.strictEqual(r.sWidth, 1600); // 900 * (16/9)
  assert.strictEqual(r.sx, 250);      // (2100 - 1600) / 2
  assert.strictEqual(r.sy, 0);
});

test('centerCropRect crops top/bottom when 16:9 source hits a 2:1 target', () => {
  // 16:9 source (1920x1080, aspect 1.777) cropped to 2:1 target (2.0)
  const r = centerCropRect(1920, 1080, 2, 1);
  assert.strictEqual(r.sWidth, 1920);
  assert.strictEqual(r.sHeight, 960); // 1920 / 2
  assert.strictEqual(r.sx, 0);
  assert.strictEqual(r.sy, 60);       // (1080 - 960) / 2
});

test('centerCropRect crops top/bottom when source is taller than target', () => {
  // 4:3 source (640x480, aspect 1.333) cropped to 16:9 target (1.777)
  const r = centerCropRect(640, 480, 16, 9);
  assert.strictEqual(r.sWidth, 640);
  assert.ok(Math.abs(r.sHeight - 360) < 0.001);
  assert.strictEqual(r.sx, 0);
  assert.ok(Math.abs(r.sy - 60) < 0.001);
});

test('centerCropRect returns full frame for degenerate input', () => {
  const r = centerCropRect(0, 0, 16, 9);
  assert.deepStrictEqual(r, { sx: 0, sy: 0, sWidth: 0, sHeight: 0 });
});

test('centerCropRect keeps full frame when aspects match', () => {
  const r = centerCropRect(1000, 500, 2, 1);
  assert.strictEqual(r.sWidth, 1000);
  assert.strictEqual(r.sHeight, 500);
  assert.strictEqual(r.sx, 0);
  assert.strictEqual(r.sy, 0);
});
