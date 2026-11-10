import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { features, classify, makeTrigger } from '../logic.js';

// Real MediaPipe landmarks from the sample photos (see README > Tests).
const photos = JSON.parse(fs.readFileSync(new URL('hands.json', import.meta.url)));
const F = Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, features(v.hand, v.isLeft)]));

// Same hand, moved, resized and a little shaky: what a second recording looks like.
const jitter = ({ hand }, seed) => hand.map((p, i) => {
  const n = Math.sin(seed * 97 + i * 13) * 0.004;
  return { x: 0.2 + p.x * 0.7 + n, y: 0.1 + p.y * 0.7 - n, z: p.z * 0.7 };
});

test('features ignore hand position and size', () => {
  const h = photos.victory.hand;
  const moved = h.map((p) => ({ x: p.x * 0.5 + 0.3, y: p.y * 0.5 + 0.2, z: p.z * 0.5 }));
  features(moved).forEach((v, i) => assert.ok(Math.abs(v - features(h)[i]) < 1e-9));
});

test('left and right hands give the same features', () => {
  const h = photos.victory.hand;
  const mirrored = h.map((p) => ({ ...p, x: 1 - p.x }));
  features(mirrored, true).forEach((v, i) => assert.ok(Math.abs(v - features(h, false)[i]) < 1e-9));
});

test('custom gestures are recognized from new, shaky samples', () => {
  const samples = Object.entries(photos).flatMap(([label, v]) =>
    [1, 2, 3].map((s) => ({ label, f: features(jitter(v, s), v.isLeft) })));
  for (const [label, v] of Object.entries(photos)) {
    assert.strictEqual(classify(samples, features(jitter(v, 9), v.isLeft))?.label, label);
  }
});

test('an untrained gesture returns null instead of a wrong guess', () => {
  const samples = [{ label: 'thumbs_up', f: F.thumbs_up }, { label: 'victory', f: F.victory }];
  assert.strictEqual(classify(samples, F.thumbs_down), null);
  assert.strictEqual(classify([], F.victory), null);
});

test('trigger fires once per held gesture, through real-world flicker', () => {
  const fire = makeTrigger(400);
  let t = 0;
  // 30 fps; `flickerEvery` drops one frame to null like the recognizer does (seen in Chrome logs).
  const hold = (label, ms, flickerEvery = 0) => {
    const out = [];
    for (let i = 0; i < ms / 33; i++, t += 33) out.push(fire(flickerEvery && i % flickerEvery === 0 ? null : label, t));
    return out.filter(Boolean);
  };
  assert.deepStrictEqual(hold(null, 500), []);
  assert.deepStrictEqual(hold('up', 700), ['up']);          // held: fires once
  assert.deepStrictEqual(hold('up', 2000, 5), []);          // still held, flickering: no refire
  assert.deepStrictEqual(hold(null, 700), []);              // hand lowered
  assert.deepStrictEqual(hold('up', 700), ['up']);          // raised again: fires
  assert.deepStrictEqual(hold('down', 1500, 8), ['down']);  // flickering hold still fires (this was the bug)
  assert.deepStrictEqual(hold('up', 250), []);              // too brief: nothing
});

test('trigger still works on a slow, CPU-only machine (~7 fps)', () => {
  const fire = makeTrigger(400);
  let t = 0;
  // Frames 143 ms apart; drop 2 frames in a row every 5 (seen in CPU-only Chrome logs).
  const hold = (label, ms) => {
    const out = [];
    for (let i = 0; i < ms / 143; i++, t += 143) out.push(fire(i % 5 >= 3 ? null : label, t));
    return out.filter(Boolean);
  };
  assert.deepStrictEqual(hold('down', 2500), ['down']);
});
