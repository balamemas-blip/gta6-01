// Solmar Heat — main: the game loop, screens, wanted system, police,
// saving, and the debug handle the headless driver reads. Boots the game
// from the URL (?seed=, ?shot=) and owns the top-level state object.

import { WORLD, TUNING, MISSIONS } from './config.js';
import { mulberry32, clamp, dist } from './random.js';
import { installInput, isHeld, wasPressed, endFrame, injectKey, clearKeys } from './input.js';
import { ensureAudio, setMuted, isMuted, sfx, engineSound, sirenSound } from './audio.js';
import {
  buildCity, createParkedCars, createTraffic, createPeds,
  updateTraffic, updatePeds, updatePoliceCar, spawnPoliceCar, randomRoadPoint,
} from './world.js';
import { createPlayer, updateOnFoot, updateDriving, tryShoot, updateBullets, bulletHits } from './player.js';
import {
  createMissionState, currentMission, startMission,
  missionTarget, objectiveText, updateMissions, collectMarkers,
} from './missions.js';
import { render, VIEW_W, VIEW_H } from './render.js';
import { applyShot, shotTick } from './shots.js';

const SAVE_KEY = 'solmar-heat-save-v1';

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.mission !== 'number' || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function writeSave(mission, cash) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ mission, cash }));
  } catch { /* saving is best-effort */ }
}

function createState(seed) {
  const rng = mulberry32(seed);
  const city = buildCity(rng);
  const player = createPlayer();
  const save = readSave();
  const state = {
    seed,
    screen: 'title',
    time: 0,
    playTime: 0,
    player,
    city,
    parked: createParkedCars(rng, city.buildings),
    traffic: createTraffic(rng),
    peds: createPeds(rng),
    police: [],
    bullets: [],
    missions: createMissionState(),
    wanted: 0,
    wantedTimer: 0,
    crimeCooldown: 0,
    bustedProgress: 0,
    cam: { x: 1280, y: 960 },
    loseReason: null,
    objective: '',
    missionTarget: null,
    collectMarkers: [],
    hasSave: !!save,
    saveMission: save ? save.mission : 0,
    saveCash: save ? save.cash : 0,
    shot: null,
    hurtCooldown: 0,
    statusTimer: 0,
  };
  return state;
}

function resetRun(state, missionIndex, cash) {
  const rng = mulberry32(state.seed);
  state.city = buildCity(rng);
  state.player = createPlayer();
  state.player.cash = cash;
  state.parked = createParkedCars(rng, state.city.buildings);
  state.traffic = createTraffic(rng);
  state.peds = createPeds(rng);
  state.police = [];
  state.bullets = [];
  state.missions = createMissionState();
  state.wanted = 0;
  state.wantedTimer = 0;
  state.bustedProgress = 0;
  state.playTime = 0;
  state.loseReason = null;
  startMission(state.missions, missionIndex);
  const m = currentMission(state.missions);
  if (m && m.wantedOnStart) state.wanted = m.wantedOnStart;
  state.screen = 'playing';
}

function raiseWanted(state, n) {
  if (state.crimeCooldown > 0) return;
  state.crimeCooldown = 2;
  state.wanted = Math.min(5, state.wanted + n);
  state.wantedTimer = 0;
}

function lose(state, reason) {
  state.screen = 'lose';
  state.loseReason = reason;
  if (reason === 'busted') sfx.busted();
  clearKeys();
}

function winGame(state) {
  state.screen = 'win';
  sfx.win();
  clearKeys();
}

function syncPolice(state, dt) {
  const want = state.wanted > 0 ? Math.min(state.wanted, TUNING.maxPolice) : 0;
  const rng = mulberry32((state.seed * 1000 + Math.floor(state.time * 2)) % 2147483647);
  let attempts = 0;
  while (state.police.length < want && attempts < 40) {
    attempts++;
    const spot = randomRoadPoint(rng);
    if (dist(spot.x, spot.y, state.player.x, state.player.y) < 520) continue;
    state.police.push(spawnPoliceCar(spot.x, spot.y));
  }
  if (state.wanted === 0) state.police.length = 0;
  // Disabled police cars (shot to pieces) are towed away.
  for (let i = state.police.length - 1; i >= 0; i--) {
    if (state.police[i].hp <= 0) state.police.splice(i, 1);
  }
}

function updatePlaying(state, dt) {
  const p = state.player;
  state.playTime += dt;
  state.crimeCooldown -= dt;
  state.hurtCooldown -= dt;

  // Player movement / driving.
  let stoleCar = false;
  if (p.inCar) {
    const res = updateDriving(p, dt, state.city.buildings, state.traffic, state.peds);
    for (const ped of state.peds) {
      if (ped.hit && !ped.counted) {
        ped.counted = true;
        raiseWanted(state, 1);
      }
    }
    if (res.crashed && Math.abs(res.speed) > TUNING.crashDamageSpeed) state.hurtCooldown = 5;
  } else {
    const res = updateOnFoot(p, dt, state.city.buildings, [...state.parked, ...state.traffic]);
    if (res === 'steal') {
      stoleCar = true;
      raiseWanted(state, 1);
    }
    tryShoot(p, state.bullets);
  }
  updateBullets(state.bullets, dt, state.city.buildings);
  const hits = bulletHits(state.bullets, state.police, state.peds);
  if (hits.policeHit) raiseWanted(state, 1);
  if (hits.pedHit) raiseWanted(state, 1);

  // Traffic and pedestrians.
  updateTraffic(state.traffic, dt, state.city.buildings);
  const threat = p.inCar
    ? { x: p.x, y: p.y, fast: Math.abs(p.inCar.speed) > 200 }
    : { x: p.x, y: p.y, fast: false };
  updatePeds(state.peds, dt, state.city.buildings, threat);
  for (const ped of state.peds) {
    if (ped.hit && !ped.counted) {
      ped.counted = true;
      raiseWanted(state, 1);
    }
  }

  // Wanted decay: break line of sight for a while and the heat cools.
  if (state.wanted > 0) {
    let nearest = Infinity;
    for (const c of state.police) nearest = Math.min(nearest, dist(c.x, c.y, p.x, p.y));
    if (nearest > 500) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= TUNING.wantedDecaySeconds) {
        state.wanted--;
        state.wantedTimer = 0;
      }
    } else {
      state.wantedTimer = 0;
    }
  }
  syncPolice(state, dt);

  // Police chase + busted meter.
  let contact = false;
  for (const car of state.police) {
    const d = updatePoliceCar(car, dt, p, state.city.buildings);
    if (d < 34) {
      contact = true;
      if (state.hurtCooldown <= 0) {
        p.health -= TUNING.policeRamDamage * dt;
        state.hurtCooldown = 0.4;
      }
      // Ram shove: push the player's car a little.
      if (p.inCar) {
        p.inCar.x += Math.cos(car.angle) * 30 * dt;
        p.inCar.y += Math.sin(car.angle) * 30 * dt;
      }
    }
  }
  if (contact && state.wanted > 0) {
    // The police can only cuff you when they have actually stopped you:
    // on foot, or crawling in a car. A car at speed cannot be busted by
    // a ram — it takes damage instead, so a moving driver stays free.
    const bustable = !p.inCar || Math.abs(p.inCar.speed) < 120;
    if (bustable) state.bustedProgress += dt / TUNING.bustedHoldSeconds;
    else state.bustedProgress = Math.max(0, state.bustedProgress - dt);
    if (state.bustedProgress >= 1) {
      lose(state, 'busted');
      return;
    }
  } else {
    state.bustedProgress = Math.max(0, state.bustedProgress - dt * 1.5);
  }

  // Slow health regen when out of trouble.
  if (state.hurtCooldown <= 0 && p.health < 100 && state.wanted === 0) {
    p.health = Math.min(100, p.health + 1.5 * dt);
  }
  if (p.health <= 0) {
    lose(state, 'wasted');
    return;
  }

  // Missions.
  const result = updateMissions(state.missions, {
    dt,
    stoleCar,
    playerPos: { x: p.x, y: p.y },
  });
  if (result === 'missionDone') {
    const m = MISSIONS[state.missions.index];
    p.cash += m.reward;
    sfx.coin();
    sfx.mission();
    const next = state.missions.index + 1;
    writeSave(Math.min(next, MISSIONS.length - 1), p.cash);
    if (next >= MISSIONS.length) {
      winGame(state);
      return;
    }
    startMission(state.missions, next);
    const nm = currentMission(state.missions);
    if (nm && nm.wantedOnStart) state.wanted = Math.max(state.wanted, nm.wantedOnStart);
    state.missions.banner = `${nm.title} — ${nm.brief}`;
    state.missions.bannerTimer = 3.5;
  } else if (result === 'stepDone') {
    sfx.pickup();
  }
  const m = currentMission(state.missions);
  if (m && m.wantedOnStart && state.missions.step === 0 && state.wanted < m.wantedOnStart) {
    state.wanted = m.wantedOnStart;
  }
  state.objective = objectiveText(state.missions);
  state.missionTarget = missionTarget(state.missions);
  state.collectMarkers = collectMarkers(state.missions);

  // Camera follows the player.
  state.cam.x += (p.x - state.cam.x) * Math.min(1, dt * 5);
  state.cam.y += (p.y - state.cam.y) * Math.min(1, dt * 5);
  state.cam.x = clamp(state.cam.x, VIEW_W / 2, WORLD.w - VIEW_W / 2);
  state.cam.y = clamp(state.cam.y, VIEW_H / 2, WORLD.h - VIEW_H / 2);

  // Sound.
  engineSound(p.inCar ? Math.abs(p.inCar.speed) / TUNING.carMaxSpeed : 0, !!p.inCar);
  sirenSound(dt, state.wanted);
}

function update(state, dt) {
  if (state.screen === 'title') {
    state.cam.x = 1280 + Math.sin(state.time * 0.08) * 260;
    state.cam.y = 960 + Math.cos(state.time * 0.06) * 160;
    updateTraffic(state.traffic, dt, state.city.buildings);
    updatePeds(state.peds, dt, state.city.buildings, null);
    if (wasPressed('confirm')) {
      ensureAudio();
      resetRun(state, 0, 0);
    }
    return;
  }
  if (state.screen === 'playing') {
    if (wasPressed('pause')) {
      state.screen = 'paused';
      return;
    }
    if (wasPressed('mute')) setMuted(!isMuted());
    updatePlaying(state, dt);
    return;
  }
  if (state.screen === 'paused') {
    if (wasPressed('pause') || wasPressed('confirm')) state.screen = 'playing';
    if (wasPressed('mute')) setMuted(!isMuted());
    return;
  }
  if (state.screen === 'win' || state.screen === 'lose') {
    if (wasPressed('restart')) {
      const idx = state.screen === 'lose' ? state.missions.index : 0;
      const cash = state.screen === 'lose' ? state.player.cash : 0;
      resetRun(state, idx, Math.max(0, cash));
    } else if (wasPressed('confirm')) {
      resetRun(state, 0, 0);
    }
  }
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 7) || 7;
  const state = createState(seed);
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  installInput();

  // Continue key: 'C' is not in the input map, so watch it directly.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC' && state.screen === 'title' && state.hasSave && !e.repeat) {
      ensureAudio();
      resetRun(state, state.saveMission, state.saveCash);
    }
  });

  // Screenshot staging (?shot=start|street|chase|win).
  const shot = params.get('shot');
  if (shot) {
    state.shot = shot;
    applyShot(state, shot);
  }

  let last = performance.now();
  let frames = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    state.time += dt;
    frames++;
    if (state.shot) shotTick(state, dt);
    update(state, dt);
    render(ctx, state);
    // Screen-reader status, a few times a second.
    state.statusTimer += dt;
    if (state.statusTimer > 0.5) {
      state.statusTimer = 0;
      const m = currentMission(state.missions);
      statusEl.textContent = state.screen === 'playing'
        ? `${m ? m.title : 'Free roam'}. ${state.objective}. Cash $${state.player.cash}. Wanted ${state.wanted} stars.`
        : state.screen;
    }
    endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Driver / test handle: read-only view of the live state.
  window.__solmar = {
    version: 1,
    get state() {
      const p = state.player;
      const m = currentMission(state.missions);
      const target = state.missionTarget;
      return {
        screen: state.screen,
        seed: state.seed,
        time: state.time,
        playTime: state.playTime,
        player: {
          x: Math.round(p.x), y: Math.round(p.y),
          angle: p.angle, facing: p.facing,
          health: Math.round(p.health), cash: p.cash,
          inCar: !!p.inCar,
          carSpeed: p.inCar ? Math.round(p.inCar.speed) : 0,
        },
        mission: m ? {
          index: state.missions.index, id: m.id, title: m.title,
          step: state.missions.step, steps: m.steps.length,
          objective: state.objective, done: state.missions.done,
          target: target ? { x: target.x, y: target.y, name: target.name } : null,
        } : null,
        wanted: state.wanted,
        police: state.police.length,
        bustedProgress: state.bustedProgress,
        loseReason: state.loseReason,
        hasSave: state.hasSave,
        saveMission: state.saveMission,
        parked: state.parked.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
        buildings: state.city.buildings,
        traffic: state.traffic.length,
        peds: state.peds.length,
        frames,
      };
    },
    keys: { press: (action, down) => injectKey(action, down) },
    start: () => { ensureAudio(); resetRun(state, 0, 0); },
  };
  window.__solmarReady = true;
}

boot();
