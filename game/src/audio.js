// Solmar Heat — synthesised sound.
// Every effect is a small WebAudio oscillator burst: no audio files,
// no network, nothing to load. Created lazily on the first key press
// so headless screenshot runs stay silent and error-free.

let ctx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function audio() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq, dur, type, vol, slideTo) {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  } catch {
    // Sound is garnish: never let it break the game.
  }
}

export function sfxPickup() {
  blip(660, 0.12, 'sine', 0.16, 990);
}

export function sfxShoot() {
  blip(180, 0.09, 'square', 0.12, 70);
}

export function sfxHit() {
  blip(120, 0.15, 'sawtooth', 0.14, 60);
}

export function sfxCrash() {
  blip(90, 0.25, 'sawtooth', 0.2, 40);
}

export function sfxSiren() {
  blip(740, 0.5, 'sine', 0.05, 980);
}

export function sfxJobDone() {
  blip(523, 0.14, 'sine', 0.18);
  setTimeout(() => blip(659, 0.14, 'sine', 0.18), 130);
  setTimeout(() => blip(784, 0.22, 'sine', 0.18), 260);
}

export function sfxBusted() {
  blip(392, 0.4, 'sawtooth', 0.14, 196);
}

export function sfxEnterCar() {
  blip(220, 0.1, 'triangle', 0.14, 330);
}
