// Bahia Verde Heat — entry point: the frame loop, screens, saving, and the
// screenshot staging. All game rules live in the other modules; this file
// only wires them to the canvas, the keyboard and localStorage.
import { createGame, updateGame, autopilot } from './core.js';
import { drawGame, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { bindInput, readInput, injectKey } from './input.js';
import { stageShot } from './shots.js';
import { createAudio, unlockAudio, setMuted, playEvent, stepAudio } from './audio.js';
import { SAVE_KEY } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const audio = createAudio();

let state = createGame();
let autoDrive = false;
let lastTime = 0;
let saveChecked = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.mission !== 'number' || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      mission: state.missions.index,
      cash: state.player.cash,
      hp: state.player.hp,
      x: state.player.x,
      y: state.player.y,
      time: state.world.time,
    }));
  } catch {
    // Private mode or full storage: the game plays on without saving.
  }
}

function applySave(data) {
  state.missions.index = Math.max(0, Math.min(4, data.mission));
  state.player.cash = data.cash;
  state.player.hp = Math.max(1, Math.min(100, data.hp || 100));
  state.player.x = data.x;
  state.player.y = data.y;
  state.player.onFoot = true;
  state.player.inCar = null;
  state.screen = SCREEN_PLAY;
}

function drainEvents() {
  for (const event of state.events) {
    playEvent(audio, event.type);
    if (event.type === 'mission' || event.type === 'win') writeSave();
  }
  state.events = [];
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(1 / 30, Math.max(0, (now - lastTime) / 1000 || 0));
  lastTime = now;
  const input = autoDrive ? autopilot(state) : readInput();
  if (!autoDrive && (input.pause || input.mute || input.restart || input.confirm)) {
    unlockAudio(audio);
  }
  if (input.mute) setMuted(audio, !audio.muted);

  if (state.screen === SCREEN_TITLE) {
    if (!saveChecked) {
      saveChecked = true;
      state.hasSave = loadSave() !== null;
    }
    if (input.restart) {
      state.screen = SCREEN_PLAY;
    } else if (input.confirm) {
      unlockAudio(audio);
      const save = loadSave();
      if (save) applySave(save);
      else state.screen = SCREEN_PLAY;
    }
    // A gentle camera drift over the city behind the title.
    state.camera.x = 500 + Math.sin(state.world.time * 0.05) * 120;
    state.camera.y = 200;
    state.world.time += dt;
  } else if (state.screen === SCREEN_PLAY) {
    if (input.pause) {
      state.screen = SCREEN_PAUSE;
    } else {
      updateGame(state, input, dt, canvas.width, canvas.height);
      drainEvents();
    }
  } else if (state.screen === SCREEN_PAUSE) {
    if (input.pause || input.confirm) state.screen = SCREEN_PLAY;
    if (input.restart) {
      state = createGame();
      state.screen = SCREEN_PLAY;
    }
  } else if (state.screen === SCREEN_OVER || state.screen === SCREEN_WIN) {
    if (input.restart || input.confirm) {
      const fresh = createGame();
      fresh.hasSave = state.hasSave;
      state = fresh;
      state.screen = SCREEN_PLAY;
    }
  }
  stepAudio(audio, state);
  drawGame(ctx, state, canvas.width, canvas.height);
  if (statusEl) {
    const mission = state.missions.index + 1;
    statusEl.textContent = state.screen === SCREEN_PLAY
      ? `Job ${Math.min(5, mission)} of 5. Cash $${state.player.cash}. Health ${Math.round(state.player.hp)}. Wanted ${state.player.wanted} stars.`
      : state.screen;
  }
}

function start() {
  resize();
  window.addEventListener('resize', resize);
  bindInput();
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    // Screenshot staging: the scene is the real game, played forward.
    state = stageShot(shot);
    state.hasSave = false;
    resize();
    drawGame(ctx, state, canvas.width, canvas.height);
    document.title = `Bahia Verde Heat — ${shot}`;
    window.__verde = {
      state,
      screen: state.screen,
      shot,
      auto: false,
    };
    return;
  }
  if (params.get('auto') === '1') autoDrive = true;
  window.__verde = {
    get state() { return state; },
    get screen() { return state.screen; },
    get auto() { return autoDrive; },
    set auto(value) { autoDrive = !!value; },
    startAuto() { autoDrive = true; state.screen = SCREEN_PLAY; },
    press(name) { injectKey(name, true); setTimeout(() => injectKey(name, false), 80); },
    hold(name, ms) {
      injectKey(name, true);
      setTimeout(() => injectKey(name, false), ms || 500);
    },
  };
  requestAnimationFrame(frame);
}

start();
