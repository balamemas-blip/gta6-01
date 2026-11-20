// Solmar Heat — keyboard input.
// Tracks held keys and edge-triggered presses (E, Space, P, M, R,
// Enter). The game reads this, never raw DOM events.

const HELD = new Set();
const PRESSED = new Set();

const ALIASES = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  shift: 'run',
  ' ': 'shoot',
  e: 'action',
  p: 'pause',
  m: 'mute',
  r: 'restart',
  enter: 'confirm',
};

export function initInput() {
  window.addEventListener('keydown', (e) => {
    const key = ALIASES[e.key.toLowerCase()] || e.key.toLowerCase();
    if (['up', 'down', 'left', 'right', 'shoot'].includes(key)) e.preventDefault();
    if (!e.repeat) PRESSED.add(key);
    HELD.add(key);
  });
  window.addEventListener('keyup', (e) => {
    const key = ALIASES[e.key.toLowerCase()] || e.key.toLowerCase();
    HELD.delete(key);
  });
  window.addEventListener('blur', () => HELD.clear());
}

export function held(name) {
  return HELD.has(name);
}

export function pressed(name) {
  return PRESSED.has(name);
}

// Call once per frame after the game has read the presses.
export function endFrameInput() {
  PRESSED.clear();
}

// Synthetic input for the in-browser playtest driver: lets an automated
// run press keys through the same path a human does.
export function injectKey(kind, code) {
  const ev = new KeyboardEvent(kind, { key: code, bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
}
