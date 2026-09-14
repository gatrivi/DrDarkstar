// Uptown / downtown split: the demo starts in a quiet rain-soaked sanctuary.
// The hunt is a choice you make by walking past the sector gate.
export const ZEN = {
  gate: 640,          // x where Sector 10 (hunting grounds) begins
  noodleX: 108,       // the noodle bar stall on the uptown street
  noodleRadius: 52,   // interactable warmth zone around the stall
  photoCap: 6,        // Esper film strip holds six exposures
};

export const PHOTO_LOGS = [
  'ALL THOSE MOMENTS LOST IN TEARS, LIKE RAIN IN TIME',
  'ENHANCE 224 TO 176. TRACK 45 RIGHT. STOP.',
  'VOIGHT-KAMPFF: NEGATIVE. HUMAN. PROBABLY.',
  'SOMEONE ELSE WAS HERE. LOOK AGAIN.',
  'NOT A REPLICANT. JUST RAIN ON GLASS.',
  'THE LIGHT THAT BURNS TWICE AS BRIGHT BURNS HALF AS LONG',
  'GREEN SCREEN. THREE PANELS. ONE GUN. WAIT—',
  'NOODLE BAR, 23:40. THE DOVES WERE A GIFT.',
];

export function zoneOf(x) { return x > ZEN.gate ? 'downtown' : 'uptown'; }
export function pastGate(x) { return x > ZEN.gate; }
export function inNoodleBar(x) { return Math.abs(x - ZEN.noodleX) <= ZEN.noodleRadius; }
export function photoLog(i) { return PHOTO_LOGS[((i % PHOTO_LOGS.length) + PHOTO_LOGS.length) % PHOTO_LOGS.length]; }
// Newest exposure first in memory, capped: the oldest shot falls off the strip.
export function filmStrip(photos, shot) { return [...photos, shot].slice(-ZEN.photoCap); }
