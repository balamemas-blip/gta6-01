// Bahia Verde Heat — core: the game state, one update step, and the
// autopilot that stages screenshots and proves the game is winnable.
// The autopilot only presses the same keys a player would (steer, throttle,
// E, Space); it never teleports or edits mission state.
import { WORLD } from './config.js';
import { createWorld, stepTraffic, stepPeds, refreshTraffic } from './world.js';
import { createPlayer, stepPlayer, nearestCar } from './player.js';
import { stepPolice } from './police.js';
import { createMissions, stepMissions, stepBullets, stepPickups, missionTarget } from './missions.js';

export function createGame() {
  const world = createWorld(WORLD.seed);
  return {
    world,
    player: createPlayer(),
    missions: createMissions(),
    screen: 'title',
    camera: { x: 0, y: 0 },
    hasSave: false,
    auto: { stuck: 0, reverse: 0, lastX: 0, lastY: 0, leg: 0, legTarget: '', turnDir: 1, cruiseY: 0 },
    events: [],
  };
}

export function updateGame(state, input, dt, vw, vh) {
  const { world, player, missions } = state;
  world.time += dt;
  stepPlayer(world, player, input, dt, state.events);
  stepTraffic(world, dt);
  refreshTraffic(world);
  stepPeds(world, dt);
  stepPolice(world, player, dt, state.events);
  stepMissions(world, missions, player, dt, state.events);
  stepBullets(world, missions, player, dt, state.events);
  stepPickups(world, player, dt, state.events);
  stepParticles(world, dt);
  // Camera follows the player, clamped to the city.
  const tx = player.x - vw / 2;
  const ty = player.y - vh / 2 + 40;
  state.camera.x += (Math.max(0, Math.min(WORLD.width - vw, tx)) - state.camera.x) * Math.min(1, dt * 6);
  state.camera.y += (Math.max(0, Math.min(WORLD.height - vh, ty)) - state.camera.y) * Math.min(1, dt * 6);
  if (missions.done) state.screen = 'win';
  else if (player.busted || player.wasted) state.screen = 'over';
}

function stepParticles(world, dt) {
  const kept = [];
  for (const p of world.particles) {
    p.life -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    if (p.life > 0) kept.push(p);
  }
  world.particles = kept;
}

function blankInput() {
  return { x: 0, y: 0, run: false, shootHeld: false, action: false, shoot: false, pause: false, mute: false, restart: false, confirm: false };
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Drive the game like a player: steer toward the objective, steal a car when
// on foot, shoot rivals when in range, and run from the cops on job 3.
export function autopilot(state) {
  const input = blankInput();
  const { world, player, missions } = state;
  if (state.screen !== 'play' || player.busted || player.wasted || missions.done) return input;
  const target = missionTarget(world, missions, player);
  const mission = missions.index + 1;

  // Job 4 is fought on foot: walk at the nearest living rival and shoot.
  if (mission === 4 && player.onFoot) {
    let best = null;
    let bestD = Infinity;
    for (const r of world.rivals) {
      if (r.hp <= 0) continue;
      const d = Math.hypot(r.x - player.x, r.y - player.y);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) {
      const a = Math.atan2(best.y - player.y, best.x - player.x);
      if (bestD > 240) {
        input.x = Math.cos(a);
        input.y = Math.sin(a);
        input.run = true;
      } else {
        input.x = Math.cos(a) * 0.6;
        input.y = Math.sin(a) * 0.6;
        input.shoot = true;
      }
      return input;
    }
  }

  // On foot: walk to the nearest car anywhere (not just within stealing
  // reach — after a fight the car may be a street away) and steal it.
  if (player.onFoot) {
    let car = null;
    let bestD = Infinity;
    for (const c of world.cars) {
      if (c.kind === 'police') continue;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < bestD) { bestD = d; car = c; }
    }
    if (car) {
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < 46) {
        input.action = true;
        return input;
      }
      const a = Math.atan2(car.y - player.y, car.x - player.x);
      input.x = Math.cos(a);
      input.y = Math.sin(a);
      input.run = true;
      return input;
    }
    // No car in reach: walk toward the objective; a parked car is nearby.
    if (target) {
      const a = Math.atan2(target.y - player.y, target.x - player.x);
      input.x = Math.cos(a);
      input.y = Math.sin(a);
      input.run = true;
    }
    return input;
  }

  // In a car: steer toward the target. Job 4 is fought on foot, so get out
  // once the car reaches the turf.
  let tx = target ? target.x : player.x;
  let ty = target ? target.y : player.y;
  const distToTarget = Math.hypot(tx - player.x, ty - player.y);
  if (mission === 4 && distToTarget < 150) {
    input.action = true;
    return input;
  }
  if (mission === 3) {
    // Run away from the nearest cop.
    let cop = null;
    let bestD = Infinity;
    for (const c of world.cops) {
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < bestD) { bestD = d; cop = c; }
    }
    if (cop) {
      const a = Math.atan2(player.y - cop.y, player.x - cop.x);
      tx = player.x + Math.cos(a) * 500;
      ty = player.y + Math.sin(a) * 500;
      // Never flee into a corner: keep the escape route inside the city.
      tx = Math.max(300, Math.min(WORLD.width - 300, tx));
      ty = Math.max(300, Math.min(WORLD.height - 300, ty));
    }
  } else {
    // Cruise the roads in three legs: line up with the nearest road, drive
    // along it to the target's column, then turn in for the final approach.
    // Straight-line driving cuts across blocks and wrecks the car on corners.
    const legTarget = `${missions.index}:${Math.round(tx)},${Math.round(ty)}`;
    if (state.auto.legTarget !== legTarget) {
      state.auto.legTarget = legTarget;
      state.auto.leg = 0;
    }
    const roadY = 200 + Math.round((player.y - 200) / 400) * 400;
    const roadX = 200 + Math.round((tx - 200) / 400) * 400;
    const roadXHere = 200 + Math.round((player.x - 200) / 400) * 400;
    if (state.auto.leg === 0) {
      // Line up with the nearest road INTERSECTION, not just the road line:
      // driving straight at the road from mid-block clips building corners.
      tx = roadXHere;
      ty = roadY;
      if (Math.abs(player.y - roadY) < 15 && Math.abs(player.x - roadXHere) < 40) {
        state.auto.leg = 1;
        state.auto.cruiseY = roadY;
      }
    } else if (state.auto.leg === 1) {
      // Cruise along the road line itself, not the car's current y: holding
      // a fixed y lets a small steering error drift the car into a
      // building face, while the road line keeps correcting back to it.
      tx = roadX;
      ty = state.auto.cruiseY || player.y;
      if (Math.abs(player.x - roadX) < 60) state.auto.leg = 2;
    }
  }
  const car = player.inCar;
  const wantAngle = Math.atan2(ty - player.y, tx - player.x);
  const diff = angleDiff(car.angle, wantAngle);
  const dist = Math.hypot(tx - player.x, ty - player.y);
  // Stuck detection: barely moving while the target is far away.
  const moved = Math.hypot(player.x - state.auto.lastX, player.y - state.auto.lastY);
  state.auto.lastX = player.x;
  state.auto.lastY = player.y;
  if (moved < 2 && dist > 80) state.auto.stuck += 1;
  else state.auto.stuck = 0;
  if (state.auto.stuck > 90) {
    state.auto.reverse = 50;
    state.auto.stuck = 0;
    state.auto.turnDir = (state.auto.turnDir || 1) * -1;
  }
  if (state.auto.reverse > 0) {
    // Turnaround: drive forward with the wheel hard over. Reversing out
    // only works when there is room behind the car; against a wall it
    // wedges the car, so the recovery always goes forward.
    state.auto.reverse -= 1;
    input.y = -1;
    input.x = state.auto.turnDir || 1;
    return input;
  }
  input.y = -1;
  input.x = Math.abs(diff) > 0.03 ? (diff > 0 ? 1 : -1) : 0;
  // Coast (don't throttle) while turning hard or closing in fast: ramming
  // a building at full speed is what wrecks the car and the driver.
  const carSpeed = Math.abs(car.speed);
  if (Math.abs(diff) > 0.7 && carSpeed > 120) input.y = 0;
  if (dist < 200 && carSpeed > 200) input.y = 0;
  if (dist < 60 && mission !== 3 && state.auto.leg === 2) input.y = 0;
  return input;
}
