// Bahia Verde Heat — sound: everything is synthesized with WebAudio, no
// audio files. A low engine hum, a two-tone siren, gunshots, pickups and a
// little mission-complete jingle. M toggles mute; audio starts on first input.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenPhase: 0,
    musicTimer: 0,
    musicStep: 0,
  };
}

function ensure(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    audio.engineOsc.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  } catch {
    return false;
  }
  return true;
}

export function unlockAudio(audio) {
  ensure(audio);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}

function blip(audio, freq, dur, type, vol) {
  if (!ensure(audio) || audio.muted) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol || 0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(audio, dur, vol, lowpass) {
  if (!ensure(audio) || audio.muted) return;
  const t = audio.ctx.currentTime;
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = audio.ctx.createGain();
  gain.gain.value = vol;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass || 3000;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(t);
}

// One call per game event; keeps the sound code out of the game logic.
export function playEvent(audio, type) {
  if (!ensure(audio)) return;
  if (type === 'shot') noise(audio, 0.12, 0.35, 2400);
  else if (type === 'enemyShot') noise(audio, 0.1, 0.16, 1800);
  else if (type === 'pickup') { blip(audio, 880, 0.12, 'sine', 0.25); blip(audio, 1320, 0.16, 'sine', 0.2); }
  else if (type === 'mission') {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(audio, f, 0.18, 'triangle', 0.25), i * 110));
  } else if (type === 'steal') blip(audio, 220, 0.15, 'square', 0.12);
  else if (type === 'hurt') blip(audio, 140, 0.2, 'sawtooth', 0.25);
  else if (type === 'heal') blip(audio, 660, 0.2, 'sine', 0.2);
  else if (type === 'crash') noise(audio, 0.25, 0.4, 900);
  else if (type === 'win') {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(audio, f, 0.3, 'triangle', 0.25), i * 130));
  }
}

// Continuous sounds follow the game state each frame.
export function stepAudio(audio, state) {
  if (!audio.ctx) return;
  const player = state.player;
  const speed = player.inCar ? Math.abs(player.inCar.speed) : 0;
  if (audio.engineGain) {
    audio.engineGain.gain.value = player.inCar ? 0.03 + (speed / 430) * 0.05 : 0;
    audio.engineOsc.frequency.value = 50 + (speed / 430) * 130;
  }
  if (audio.sirenGain && audio.sirenOsc) {
    const wanted = player.wanted;
    audio.sirenGain.gain.value = wanted > 0 ? 0.035 : 0;
    audio.sirenPhase += 0.02;
    audio.sirenOsc.frequency.value = audio.sirenPhase % 2 < 1 ? 720 : 540;
  }
  // A lazy bassline while playing: one note every half second.
  if (state.screen === 'play') {
    audio.musicTimer -= 1 / 60;
    if (audio.musicTimer <= 0) {
      audio.musicTimer = 0.5;
      const notes = [55, 55, 65.4, 49, 55, 58.3, 65.4, 73.4];
      const f = notes[audio.musicStep % notes.length];
      audio.musicStep += 1;
      blip(audio, f, 0.42, 'triangle', 0.08);
    }
  }
}
