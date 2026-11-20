// Solmar Heat — audio: a tiny WebAudio synth. No audio files, no network:
// every sound is an oscillator or filtered noise built at runtime.

let ctx = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenTimer = 0;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  } catch {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (engineGain) engineGain.gain.value = 0;
}

export function isMuted() {
  return muted;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch { /* audio is best-effort */ }
}

function noiseBurst(dur, vol) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(t);
  } catch { /* audio is best-effort */ }
}

export const sfx = {
  pickup() { blip(880, 0.12, 'sine', 0.12, 1320); },
  coin() { blip(1320, 0.1, 'sine', 0.1); setTimeout(() => blip(1760, 0.14, 'sine', 0.1), 70); },
  mission() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.12), i * 90));
  },
  shoot() { noiseBurst(0.09, 0.18); },
  crash() { noiseBurst(0.18, 0.22); blip(90, 0.18, 'sawtooth', 0.1, 45); },
  busted() { blip(220, 0.5, 'sawtooth', 0.14, 110); },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.12), i * 110));
  },
  steal() { blip(330, 0.1, 'square', 0.08, 440); },
};

// Continuous engine hum while driving; pitch follows speed.
export function engineSound(speedRatio, driving) {
  if (!ctx || muted || !driving) {
    if (engineGain) engineGain.gain.value = 0;
    return;
  }
  try {
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + speedRatio * 130;
    engineGain.gain.value = 0.02 + speedRatio * 0.035;
  } catch { /* best-effort */ }
}

// Two-tone police siren, called every frame while wanted > 0.
export function sirenSound(dt, wanted) {
  if (!ctx || muted || wanted <= 0) return;
  sirenTimer += dt;
  const phase = Math.floor(sirenTimer * 1.6) % 2;
  if (phase === 0 && sirenTimer % 1.6 < dt + 0.001) blip(700, 0.55, 'sine', 0.035);
  if (phase === 1 && sirenTimer % 1.6 < dt + 0.001) blip(950, 0.55, 'sine', 0.035);
}
