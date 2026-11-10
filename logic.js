// Pure logic shared by the pages. No DOM, no MediaPipe, so it runs under `node --test`.

// 21 hand landmarks -> 63 numbers that ignore where the hand is and how big it is.
// Left hands are mirrored so one recording works for either hand.
// ponytail: x/y are in image-relative units, so a very different camera aspect ratio skews matches; re-record if you switch cameras.
export function features(hand, isLeft = false) {
  const [w] = hand;
  const pts = hand.map((p) => [(p.x - w.x) * (isLeft ? -1 : 1), p.y - w.y, p.z - w.z]);
  const scale = Math.max(...pts.map(([x, y, z]) => Math.hypot(x, y, z))) || 1;
  return pts.flat().map((v) => v / scale);
}

const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

// k-nearest-neighbours over recorded samples [{ label, f }].
// Returns null when nothing recorded is close enough: better "unknown" than a confident wrong answer.
// Calibration knob. Different gestures measured 1.7+ apart on the sample photos.
// Raise it if your own gestures go unrecognized; lower it if the wrong one gets picked.
export const MAX_DISTANCE = 0.8;
export function classify(samples, f, k = 5, maxDist = MAX_DISTANCE) {
  const near = samples.map((s) => ({ label: s.label, d: dist(s.f, f) }))
    .filter((n) => n.d <= maxDist)
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  if (!near.length) return null;
  const votes = {};
  for (const n of near) votes[n.label] = (votes[n.label] || 0) + 1;
  const [label, count] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return { label, score: count / near.length };
}

// Fires once when a gesture has been held for holdMs. To fire again, change gesture
// (or lower your hand) for holdMs. The recognizer drops frames all the time, so while a
// gesture is showing, any other label lasting under graceMs is ignored: it neither resets
// the hold nor double-fires. 300 ms covers two dropped frames even on a slow CPU-only
// machine (~7 fps). A gesture appearing from "nothing" starts its hold immediately.
export function makeTrigger(holdMs = 400, graceMs = 300) {
  let candidate = null, since = 0, lastSeen = 0, stable = null;
  return (label, now) => {
    if (label === candidate) lastSeen = now;
    else if (candidate === null || now - lastSeen > graceMs) { candidate = label; since = now; lastSeen = now; }
    if (candidate === stable || now - since < holdMs) return null;
    stable = candidate;
    return stable;
  };
}
