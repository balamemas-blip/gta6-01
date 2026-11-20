// Solmar Heat — the player, on foot and behind the wheel.
// On foot: WASD/arrows move, Shift runs, Space fires at the nearest
// threat. In a car: W accelerates, S brakes/reverses, A/D steer, Space
// is the handbrake, E gets in and out. E near a parked car steals it.

import { CONFIG } from './config.js';
import { collideBuildings, circleHitsBuilding, clampToWorld } from './world.js';
import { held } from './input.js';
import { sfxEnterCar, sfxShoot } from './audio.js';

export function createPlayer(world) {
  return {
    x: world.spawn.x,
    y: world.spawn.y,
    r: CONFIG.player.radius,
    angle: -Math.PI / 2,
    hp: CONFIG.player.hp,
    cash: 0,
    inCar: null, // the car object when driving, else null
    lastHurtAt: -99,
    moving: false,
    shootCooldown: 0,
  };
}

function driveStep(player, car, world, dt) {
  const C = CONFIG.car;
  const forward = held('up');
  const back = held('down');
  const left = held('left');
  const right = held('right');
  const handbrake = held('shoot');

  if (forward) car.speed += C.accel * dt;
  else if (back) car.speed -= (car.speed > 5 ? C.brake : C.reverseAccel) * dt;
  else car.speed *= Math.pow(0.4, dt); // coast down

  if (handbrake) car.speed *= Math.pow(0.05, dt);
  car.speed = Math.max(-C.topReverse, Math.min(C.topSpeed, car.speed));

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * C.steerRate * dir * Math.min(1, Math.abs(car.speed) / 140) * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Axis-separated movement: a wall blocks one axis, never both, so the
  // car slides along a building instead of wedging against its corner.
  if (!circleHitsBuilding(world, nx, car.y, C.length / 2)) car.x = nx;
  else if (Math.abs(car.speed) > 120) car.speed *= 0.6;
  if (!circleHitsBuilding(world, car.x, ny, C.length / 2)) car.y = ny;
  else if (Math.abs(car.speed) > 120) car.speed *= 0.6;
  car.x = Math.max(20, Math.min(CONFIG.world.width - 20, car.x));
  car.y = Math.max(20, Math.min(CONFIG.world.height - 20, car.y));

  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.moving = Math.abs(car.speed) > 20;
}

function walkStep(player, world, dt) {
  const P = CONFIG.player;
  let dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  let dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
  const len = Math.hypot(dx, dy);
  player.moving = len > 0;
  if (!len) return;
  dx /= len;
  dy /= len;
  const speed = held('run') ? P.runSpeed : P.walkSpeed;
  player.x += dx * speed * dt;
  player.y += dy * speed * dt;
  player.angle = Math.atan2(dy, dx);
  collideBuildings(world, player);
  clampToWorld(player);
}

export function updatePlayer(player, cars, world, dt, time) {
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  if (player.inCar) {
    driveStep(player, player.inCar, world, dt);
  } else {
    walkStep(player, world, dt);
  }
  // Slow health recovery after a quiet spell.
  if (time - player.lastHurtAt > CONFIG.player.regenDelaySec && player.hp > 0) {
    player.hp = Math.min(CONFIG.player.hp, player.hp + CONFIG.player.hpRegenPerSec * dt);
  }
}

export function hurtPlayer(player, amount, time) {
  if (player.hp <= 0) return;
  player.hp -= amount;
  player.lastHurtAt = time;
}

export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.isCop) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// E: get in the nearest car, or step out of the one being driven.
export function tryEnterExitCar(player, cars) {
  if (player.inCar) {
    const car = player.inCar;
    player.inCar = null;
    car.occupied = false;
    // Step out to the side of the car, clear of its body.
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    player.angle = car.angle;
    sfxEnterCar();
    return 'exit';
  }
  const car = nearestCar(player, cars, 54);
  if (!car) return null;
  player.inCar = car;
  car.occupied = true;
  car.speed = 0;
  sfxEnterCar();
  return 'enter';
}

// Space on foot: fire at the nearest rival within range.
export function tryShoot(player, rivals) {
  if (player.inCar || player.shootCooldown > 0) return null;
  let best = null;
  let bestD = 260;
  for (const r of rivals) {
    if (r.hp <= 0) continue;
    const d = Math.hypot(r.x - player.x, r.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  if (!best) return null;
  player.shootCooldown = 0.28;
  player.angle = Math.atan2(best.y - player.y, best.x - player.x);
  sfxShoot();
  return best;
}
