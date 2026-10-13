/**
 * What the player is holding: set once at boot. `touch` means a phone or tablet (no fine
 * pointer, no hover) or `?touch`: on-screen controls, no pointer lock, wording for taps.
 */
export const device = { touch: false };

export function detectTouch(params: URLSearchParams): boolean {
  if (params.has('touch')) return true;
  return typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
}
