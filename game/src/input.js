// Solmar Heat — input: keyboard state plus edge-triggered presses.
// The game reads keys through this module only, so the headless driver
// can drive the same path with synthetic key events.

const held = new Set();
const pressed = new Set();

const CODE_ALIASES = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'enter',
  Space: 'shoot',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
  Enter: 'confirm',
  Escape: 'pause',
};

export function installInput() {
  window.addEventListener('keydown', (e) => {
    const action = CODE_ALIASES[e.code];
    if (!action) return;
    if (action === 'shoot' || action === 'pause') e.preventDefault();
    if (!e.repeat) pressed.add(action);
    held.add(action);
  });
  window.addEventListener('keyup', (e) => {
    const action = CODE_ALIASES[e.code];
    if (action) held.delete(action);
  });
  window.addEventListener('blur', () => held.clear());
}

export function isHeld(action) {
  return held.has(action);
}

// True only on the frame the key went down; consumed by endFrame().
export function wasPressed(action) {
  return pressed.has(action);
}

export function endFrame() {
  pressed.clear();
}

// Test/driver hook: pretend a key is held or pressed without a real event.
export function injectKey(action, down) {
  if (down) { held.add(action); pressed.add(action); }
  else held.delete(action);
}

export function clearKeys() {
  held.clear();
  pressed.clear();
}
