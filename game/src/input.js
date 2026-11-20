// Bahia Verde Heat — keyboard input.
// Tracks held keys and edge-triggered presses (E, Space, P, M, R) so the game
// logic can ask "is this key down right now" and "was it just pressed".
const HELD = new Set();
const PRESSED = new Set();

const ALIASES = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyE: 'action',
  Space: 'shoot',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
  Enter: 'confirm',
};

export function bindInput() {
  window.addEventListener('keydown', (event) => {
    const name = ALIASES[event.code];
    if (!name) return;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (!event.repeat) PRESSED.add(name);
    HELD.add(name);
  });
  window.addEventListener('keyup', (event) => {
    const name = ALIASES[event.code];
    if (!name) return;
    HELD.delete(name);
  });
  window.addEventListener('blur', () => {
    HELD.clear();
  });
}

// The current held-key snapshot the update loop reads.
export function readInput() {
  let x = 0;
  let y = 0;
  if (HELD.has('left')) x -= 1;
  if (HELD.has('right')) x += 1;
  if (HELD.has('up')) y -= 1;
  if (HELD.has('down')) y += 1;
  return {
    x,
    y,
    run: HELD.has('run'),
    shootHeld: HELD.has('shoot'),
    action: takePressed('action'),
    shoot: takePressed('shoot'),
    pause: takePressed('pause'),
    mute: takePressed('mute'),
    restart: takePressed('restart'),
    confirm: takePressed('confirm'),
  };
}

// Test and screenshot drivers inject keys through this same surface.
export function injectKey(name, down) {
  if (down) {
    PRESSED.add(name);
    HELD.add(name);
  } else {
    HELD.delete(name);
  }
}

export function clearInput() {
  HELD.clear();
  PRESSED.clear();
}

function takePressed(name) {
  if (!PRESSED.has(name)) return false;
  PRESSED.delete(name);
  return true;
}
