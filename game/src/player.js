// Solmar Heat — player: on-foot movement, driving, stealing cars,
// shooting, and the damage the player takes. The player object lives in
// main.js state; this module moves it.

import { WORLD, TUNING } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { collideBuildings, collideBuildingsInfo } from './world.js';
import { isHeld, wasPressed } from './input.js';
import { sfx } from './audio.js';

export function createPlayer() {
  return {
    x: 480, y: 1380, angle: -Math.PI / 2, // facing up the road by Luz Garage
    health: 100,
    cash: 0,
    inCar: null, // the car object being driven, or null
    facing: -Math.PI / 2,
    shootTimer: 0,
    hurtTimer: 0,
    runDust: 0,
  };
}

// On-foot step. Returns 'steal' when the player grabs a car this frame.
export function updateOnFoot(p, dt, buildings, cars) {
  let mx = (isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0);
  let my = (isHeld('down') ? 1 : 0) - (isHeld('up') ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    const speed = isHeld('run') ? TUNING.runSpeed : TUNING.walkSpeed;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.facing = Math.atan2(my, mx);
    p.angle = p.facing;
    p.runDust += dt;
  }
  p.x = clamp(p.x, 24, WORLD.w - 24);
  p.y = clamp(p.y, 24, WORLD.h - 110);
  collideBuildings(buildings, p, 12);
  p.shootTimer -= dt;
  p.hurtTimer -= dt;

  if (wasPressed('enter')) {
    let best = null;
    let bestD = 70;
    for (const c of cars) {
      if (c.kind === 'police') continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) {
      p.inCar = best;
      best.kind = 'player';
      best.speed = 0;
      sfx.steal();
      return 'steal';
    }
  }
  return null;
}

// Driving step. Returns { crashed: bool, speed }.
export function updateDriving(p, dt, buildings, traffic, peds) {
  const car = p.inCar;
  let crashed = false;
  const forward = isHeld('up') ? 1 : 0;
  const back = isHeld('down') ? 1 : 0;
  if (forward) car.speed += TUNING.carAccel * dt;
  else if (back) car.speed -= (car.speed > 0 ? TUNING.carBrake : TUNING.carAccel * 0.55) * dt;
  else car.speed *= Math.pow(TUNING.carDrag, dt);
  if (isHeld('shoot')) car.speed *= Math.pow(0.12, dt); // handbrake
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
  const steer = (isHeld('left') ? -1 : 0) + (isHeld('right') ? 1 : 0);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += steer * TUNING.carTurn * dirSign * Math.min(1, Math.abs(car.speed) / 140) * dt;
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 24, WORLD.w - 24);
  car.y = clamp(car.y, 24, WORLD.h - 110);
  const speedBefore = Math.abs(car.speed);
  const wall = collideBuildingsInfo(buildings, car, 13);
  if (wall) {
    if (speedBefore > TUNING.crashDamageSpeed) {
      crashed = true;
      p.health -= Math.min(12, (speedBefore - TUNING.crashDamageSpeed) / 30);
      sfx.crash();
    }
    car.speed *= 0.65;
    // Slide along the wall instead of grinding into it: steer the car
    // toward the tangent that leads around the nearer end of the face.
    if (speedBefore > 60) {
      const b = wall.b;
      let tangent;
      if (Math.abs(wall.nx) > Math.abs(wall.ny)) {
        tangent = Math.atan2(car.y - (b.y + b.h / 2) >= 0 ? 1 : -1, 0);
      } else {
        tangent = Math.atan2(0, car.x - (b.x + b.w / 2) >= 0 ? 1 : -1);
      }
      const turn = angleDiff(car.angle, tangent);
      if (Math.abs(turn) < 1.9) car.angle += turn * Math.min(1, 6 * dt);
    }
  }
  // Shove traffic cars and pedestrians out of the way; hitting a
  // pedestrian at speed is a crime and hurts the player a little.
  for (const t of traffic) {
    if (t === car) continue;
    const d = dist(car.x, car.y, t.x, t.y);
    if (d < 34 && d > 0.01) {
      const push = (34 - d) / 2;
      const nx = (t.x - car.x) / d;
      const ny = (t.y - car.y) / d;
      t.x += nx * push; t.y += ny * push;
      if (speedBefore > 200) { t.speed = car.speed * 0.4; crashed = true; }
    }
  }
  for (const ped of peds) {
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d < 26) {
      const nx = (ped.x - car.x) / (d || 1);
      const ny = (ped.y - car.y) / (d || 1);
      ped.x += nx * 60 * dt * 10;
      ped.y += ny * 60 * dt * 10;
      ped.flee = 1.5;
      if (speedBefore > 120) {
        ped.hit = true;
        crashed = true; // caller counts the crime once per pedestrian
      }
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (wasPressed('enter')) {
    // Step out beside the car, facing the same way.
    p.inCar = null;
    car.kind = 'parked';
    car.speed = 0;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.facing = car.angle;
  }
  return { crashed, speed: car.speed };
}

// Fire a bullet in the facing direction. Returns a bullet or null.
export function tryShoot(p, bullets) {
  if (p.inCar || p.shootTimer > 0) return null;
  if (!wasPressed('shoot')) return null;
  p.shootTimer = TUNING.shootCooldown;
  const b = {
    x: p.x + Math.cos(p.facing) * 20,
    y: p.y + Math.sin(p.facing) * 20,
    vx: Math.cos(p.facing) * TUNING.bulletSpeed,
    vy: Math.sin(p.facing) * TUNING.bulletSpeed,
    life: 0.9,
  };
  bullets.push(b);
  sfx.shoot();
  return b;
}

export function updateBullets(bullets, dt, buildings) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.life <= 0 || b.x < 0 || b.x > WORLD.w || b.y < 0 || b.y > WORLD.h) {
      bullets.splice(i, 1);
      continue;
    }
    const probe = { x: b.x, y: b.y };
    if (collideBuildings(buildings, probe, 2) && (probe.x !== b.x || probe.y !== b.y)) {
      bullets.splice(i, 1);
    }
  }
}

// Bullets vs police cars and pedestrians. Returns { policeHit, pedHit }.
export function bulletHits(bullets, police, peds) {
  let policeHit = false;
  let pedHit = false;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let spent = false;
    for (const c of police) {
      if (dist(b.x, b.y, c.x, c.y) < 26) {
        c.hp -= TUNING.bulletDamage;
        policeHit = true;
        spent = true;
        break;
      }
    }
    if (!spent) {
      for (const ped of peds) {
        if (!ped.hit && dist(b.x, b.y, ped.x, ped.y) < 16) {
          ped.hit = true;
          pedHit = true;
          spent = true;
          break;
        }
      }
    }
    if (spent) bullets.splice(i, 1);
  }
  return { policeHit, pedHit };
}

export { angleDiff };
