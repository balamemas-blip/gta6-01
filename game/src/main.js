// Solmar Heat — game loop and state machine.
// States: title → playing ⇄ paused → won / wasted / busted.
// Progress (job, cash, HP) autosaves to localStorage; C on the title
// screen continues a saved game. ?shot=start|play|chase|win&seed=N
// stages a deterministic scene for screenshots — real renders of the
// same code path the player plays.

import { CONFIG, CITY_NAMES } from './config.js';
import { buildWorld } from './world.js';
import { mulberry32 } from './random.js';
import { initInput, held, pressed, endFrameInput } from './input.js';
import { createPlayer, updatePlayer, tryEnterExitCar, tryShoot, hurtPlayer } from './player.js';
import { createTraffic, updateTrafficCar, createPedestrians, updatePedestrian } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createMissions, updateMissions, currentObjective, missionMarkers } from './missions.js';
import { createCamera, updateCamera, render, drawTitle, drawEnd, drawPaused } from './render.js';
import { toggleMute, sfxHit } from './audio.js';

function readSave() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(game) {
  try {
    localStorage.setItem(
      CONFIG.saveKey,
      JSON.stringify({ jobIndex: game.missions.jobIndex, cash: game.player.cash, hp: game.player.hp }),
    );
  } catch {
    // Saving is a courtesy; a blocked store never stops play.
  }
}

function newGame(seed, saved) {
  const world = buildWorld(seed);
  const player = createPlayer(world);
  const missions = createMissions(world);
  if (saved) {
    missions.jobIndex = Math.min(saved.jobIndex || 0, 4);
    player.cash = saved.cash || 0;
    player.hp = saved.hp || CONFIG.player.hp;
    missions.message = `Welcome back, Danny. Job ${missions.jobIndex + 1} of 5 is waiting.`;
  }
  return {
    seed,
    world,
    player,
    missions,
    cars: createTraffic(world, CONFIG.traffic.cars),
    peds: createPedestrians(world, CONFIG.traffic.pedestrians),
    police: createPolice(),
    cam: createCamera(),
    state: 'title',
    time: 0,
    wanted: 0,
    wantedFloat: 0,
    saved: readSave(),
    shots: [],
    winAt: 0,
  };
}

function applyShotMode(game, mode) {
  // Stage a real gameplay state for a screenshot, then let the loop
  // render it: nothing here is a mock — the same update/render code
  // runs, with the camera parked on the action.
  game.state = 'playing';
  const { world, player, missions } = game;
  if (mode === 'start') {
    game.state = 'title';
    return;
  }
  if (mode === 'play') {
    const car = game.cars.find((c) => c.parked);
    player.x = car.x;
    player.y = car.y;
    player.inCar = car;
    car.occupied = true;
    car.speed = 180;
    car.angle = 0;
    game.cam.x = Math.max(0, player.x - CONFIG.canvas.width / 2);
    game.cam.y = Math.max(0, player.y - CONFIG.canvas.height / 2);
    missions.message = `${CITY_NAMES.boss}: "Nice wheels. Now bring it to the garage."`;
    missions.messageAt = game.time;
    return;
  }
  if (mode === 'chase') {
    missions.jobIndex = 2;
    missions.step = 1;
    const car = game.cars.find((c) => c.parked);
    player.x = world.roadXs[3];
    player.y = world.roadYs[2];
    player.inCar = car;
    car.occupied = true;
    car.x = player.x;
    car.y = player.y;
    car.speed = 320;
    car.angle = 0;
    game.wanted = 2;
    game.wantedFloat = 2;
    game.police.cops = [
      { x: player.x - 160, y: player.y - 90, angle: 0, speed: 300, ramAt: -99 },
      { x: player.x - 220, y: player.y + 70, angle: 0, speed: 300, ramAt: -99 },
    ];
    game.cam.x = Math.max(0, player.x - CONFIG.canvas.width / 2);
    game.cam.y = Math.max(0, player.y - CONFIG.canvas.height / 2);
    missions.message = 'Milo: "Step on it — I hear sirens already."';
    missions.messageAt = game.time;
    return;
  }
  if (mode === 'win') {
    game.state = 'won';
    game.player.cash = 10300;
    game.winAt = game.time;
  }
}

function stepRivals(game, dt) {
  const { missions, player } = game;
  if (missions.jobIndex !== 3 || missions.step !== 1) return;
  for (const r of missions.rivals) {
    if (r.hp <= 0) continue;
    const d = Math.hypot(player.x - r.x, player.y - r.y);
    if (d < 340 && !player.inCar && game.time - r.shootAt > 1.7) {
      r.shootAt = game.time;
      hurtPlayer(player, 5, game.time);
      sfxHit();
    }
  }
}

function update(game, dt) {
  game.time += dt;
  const { player, world, missions, police } = game;

  if (pressed('action')) {
    const res = tryEnterExitCar(player, game.cars);
    if (res === 'enter') missions.message = 'Car stolen. The garage is marked on the map.';
  }
  if (pressed('shoot')) {
    const hit = tryShoot(player, missions.rivals);
    if (hit) {
      hit.hp -= 1;
      sfxHit();
      if (hit.hp <= 0) game.player.cash += 50;
    }
  }
  if (pressed('mute')) toggleMute();

  updatePlayer(player, game.cars, world, dt, game.time);
  for (const car of game.cars) updateTrafficCar(car, world, dt);
  for (const ped of game.peds) updatePedestrian(ped, player, world, dt);
  stepRivals(game, dt);

  const res = updateMissions(missions, player, world, dt);
  // Wanted: the current job sets a floor; crimes near cops raise it,
  // and it cools off when the player stays clean.
  game.wantedFloat = Math.max(res.wanted, game.wantedFloat - CONFIG.wanted.decayPerSec * dt);
  if (res.wanted > 0) game.wantedFloat = Math.max(game.wantedFloat, res.wanted);
  game.wanted = Math.min(5, Math.floor(game.wantedFloat + 0.001));
  if (res.event === 'jobDone') {
    missions.messageAt = game.time;
    writeSave(game);
  }
  if (res.event === 'won') {
    game.state = 'won';
    game.winAt = game.time;
    try {
      localStorage.removeItem(CONFIG.saveKey);
    } catch {
      // ignore
    }
    return;
  }

  const bust = updatePolice(police, player, world, game.wanted, dt, game.time);
  if (bust === 'busted') {
    game.state = 'busted';
    return;
  }
  if (player.hp <= 0) {
    game.state = 'wasted';
    return;
  }
  updateCamera(game.cam, player, dt);
}

// Read-only snapshot for automated playtesting: position, objective,
// wanted level and state, so a driver can steer with real key events.
function exposeDebug(game) {
  const markers = missionMarkers(game.missions, game.world, game.player, game.cars);
  let nearCar = false;
  for (const car of game.cars) {
    if (!car.isCop && Math.hypot(car.x - game.player.x, car.y - game.player.y) < 54) {
      nearCar = true;
      break;
    }
  }
  window.__solmar = {
    state: game.state,
    x: game.player.x,
    y: game.player.y,
    hp: game.player.hp,
    cash: game.player.cash,
    wanted: game.wanted,
    jobIndex: game.missions.jobIndex,
    step: game.missions.step,
    inCar: !!game.player.inCar,
    speed: game.player.inCar ? game.player.inCar.speed : 0,
    angle: game.player.angle,
    objective: currentObjective(game.missions, game.player),
    marker: markers.length ? { x: markers[0].x, y: markers[0].y } : null,
    nearCar,
    cars: game.cars.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), angle: +c.angle.toFixed(3), speed: Math.round(c.speed), parked: c.parked, occupied: c.occupied })),
    cops: game.police.cops.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
    buildings: game.world.buildings,
    roadXs: game.world.roadXs,
    roadYs: game.world.roadYs,
    time: game.time,
  };
}

export function boot() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || '7');
  const shotMode = params.get('shot');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const game = newGame(seed, null);
  initInput();
  if (shotMode) applyShotMode(game, shotMode);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (game.state === 'title') {
      if (pressed('confirm')) {
        game.state = 'playing';
        game.missions.messageAt = game.time;
      } else if ((pressed('c') || pressed('confirm')) && game.saved) {
        // C continues a saved game from the title screen.
      }
      if (pressed('c') && game.saved) {
        const saved = game.saved;
        const fresh = newGame(seed, saved);
        Object.assign(game, fresh, { state: 'playing' });
        game.missions.messageAt = game.time;
      }
      drawTitle(ctx, game, !!game.saved);
    } else if (game.state === 'playing') {
      if (pressed('pause')) {
        game.state = 'paused';
      } else if (pressed('restart')) {
        const fresh = newGame(seed, null);
        Object.assign(game, fresh, { state: 'playing' });
      } else {
        update(game, dt);
        if (game.state === 'playing') render(ctx, game);
      }
      if (game.state === 'paused') drawPaused(ctx);
    } else if (game.state === 'paused') {
      if (pressed('pause')) game.state = 'playing';
      drawPaused(ctx);
    } else if (game.state === 'won') {
      drawEnd(
        ctx,
        'SOLMAR IS YOURS',
        [`All five jobs done for ${CITY_NAMES.boss}.`, `Final take: $${game.player.cash.toLocaleString('en-US')}.`, 'The Big Score is in the bag.'],
        '#7dff8a',
      );
      if (pressed('confirm') || pressed('restart')) {
        const fresh = newGame(seed, null);
        Object.assign(game, fresh, { state: 'playing' });
      }
    } else if (game.state === 'wasted') {
      drawEnd(ctx, 'WASTED', ['Danny went down in the streets of Solmar.', `Take so far: $${game.player.cash.toLocaleString('en-US')}.`], '#ff5b5b');
      if (pressed('confirm') || pressed('restart')) {
        const fresh = newGame(seed, null);
        Object.assign(game, fresh, { state: 'playing' });
      }
    } else if (game.state === 'busted') {
      drawEnd(ctx, 'BUSTED', ['The Solmar PD finally caught up with Danny.', `Take so far: $${game.player.cash.toLocaleString('en-US')}.`], '#2d7dff');
      if (pressed('confirm') || pressed('restart')) {
        const fresh = newGame(seed, null);
        Object.assign(game, fresh, { state: 'playing' });
      }
    }

    exposeDebug(game);
    endFrameInput();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
