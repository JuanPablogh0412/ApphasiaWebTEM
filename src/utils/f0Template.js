export function generateF0Template(patronTonal) {
  const TONE_MAP = { L: 200.0, H: 237.8 };
  return patronTonal
    .split('')
    .map(ch => TONE_MAP[ch.toUpperCase()] ?? 200.0);
}
