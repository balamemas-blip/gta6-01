// Solmar Heat — shots: deterministic staged states for screenshots.
// Each shot is a real state of the same game code, arranged so one frame
// shows a different system at its best: the title, the street on foot,
// a police chase in a car, and the win screen. Triggered with ?shot=<name>
// (and ?seed=<n> for the city layout). No fake images, no compositing.

import { PLACES } from './config.js';
import { startMission } from './missions.js';
import { spawnPoliceCar } from './world.js';
import { dist } from './random.js';

export function applyShot(state, name) {
  const p = state.player;
  if (name === 'start') {
    state.screen = 'title';
    state.cam.x = 1280;
    state.cam.y = 960;
    return true;
  }
  if (name === 'street') {
    // On foot by Luz Garage, mission 1 active, traffic and pedestrians around.
    state.screen = 'playing';
    startMission(state.missions, 0);
    p.x = 480; p.y = 1360; p.angle = -Math.PI / 2; p.facing = -Math.PI / 2;
    p.inCar = null;
    p.health = 100;
    state.cam.x = p.x;
    state.cam.y = p.y;
    state.wanted = 0;
    return true;
  }
  if (name === 'chase') {
    // Job 5 in a stolen car, wanted 3, three police cars closing in.
    state.screen = 'playing';
    startMission(state.missions, 4);
    state.missions.step = 1; // escaping to the Hideout
    const car = state.parked[0];
    p.inCar = car;
    car.kind = 'player';
    car.x = 1120; car.y = 560; car.angle = Math.PI / 2; car.speed = 320;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    p.cash = 1900;
    state.wanted = 3;
    state.police = [];
    const spots = [[980, 420], [1260, 700], [900, 760]];
    for (const [x, y] of spots) state.police.push(spawnPoliceCar(x, y));
    state.cam.x = p.x;
    state.cam.y = p.y;
    return true;
  }
  if (name === 'win') {
    state.screen = 'win';
    p.cash = 2400;
    state.playTime = 612;
    state.wanted = 0;
    state.missions.index = 4;
    state.missions.done = true;
    state.cam.x = 1440;
    state.cam.y = 1120;
    return true;
  }
  return false;
}

// Keep the staged chase lively for a screenshot: nudge police toward the
// player without running the full wanted logic (used only in shot mode).
export function shotTick(state, dt) {
  if (state.shot !== 'chase') return;
  for (const c of state.police) {
    const d = dist(c.x, c.y, state.player.x, state.player.y);
    if (d > 160) {
      const a = Math.atan2(state.player.y - c.y, state.player.x - c.x);
      c.angle = a;
      c.x += Math.cos(a) * 200 * dt;
      c.y += Math.sin(a) * 200 * dt;
    }
  }
}
