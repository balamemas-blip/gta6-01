// Bahia Verde Heat — the player: on-foot movement, car driving, stealing,
// shooting, health, wanted level and the busted / wasted endings.
import { WORLD, PLAYER, CAR, WANTED, PLACES } from './config.js';
import { collideBuildings, carHitsBuilding, resolveCarBuildings, clampToWorld, KIND_POLICE } from './world.js';

export function createPlayer() {
  return {
    x: PLACES.start.x,
    y: PLACES.start.y,
    angle: -Math.PI / 2,
    hp: PLAYER.hpMax,
    cash: 0,
    wanted: 0,
    inCar: null,
    onFoot: true,
    lastDamageAt: -99,
    bustTimer: 0,
    busted: false,
    wasted: false,
    shootCooldown: 0,
    runDust: 0,
    wantedCooldown: 0,
    crimeCooldown: 0,
    crashCooldown: 0,
    ramCooldown: 0,
  };
}

// Find the nearest stealable car within reach of the player.
export function nearestCar(world, x, y) {
  let best = null;
  let bestD = CAR.stealRadius;
  for (const car of world.cars) {
    if (car.kind === KIND_POLICE) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function speedOf(player) {
  return player.inCar ? Math.abs(player.inCar.speed) : player.footSpeed || 0;
}

export function stepPlayer(world, player, input, dt, events) {
  if (player.busted || player.wasted) return;
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.crimeCooldown = Math.max(0, player.crimeCooldown - dt);
  player.crashCooldown = Math.max(0, player.crashCooldown - dt);
  player.ramCooldown = Math.max(0, player.ramCooldown - dt);

  if (player.onFoot) {
    stepOnFoot(world, player, input, dt, events);
  } else {
    stepDriving(world, player, input, dt, events);
  }

  // Wanted level decays after a quiet stretch with no new crime.
  if (player.wanted > 0) {
    player.wantedCooldown -= dt;
    if (player.wantedCooldown <= 0) {
      player.wanted = Math.max(0, player.wanted - 1);
      player.wantedCooldown = WANTED.decaySeconds;
    }
  }
  // Slow health recovery after 6 seconds without damage.
  if (world.time - player.lastDamageAt > 6 && player.hp < PLAYER.hpMax) {
    player.hp = Math.min(PLAYER.hpMax, player.hp + 3 * dt);
  }
  updateBust(world, player, dt, events);
}

function stepOnFoot(world, player, input, dt, events) {
  const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = input.x;
  let my = input.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    player.angle = Math.atan2(my, mx);
  }
  player.footSpeed = len > 0 ? speed : 0;
  let nx = player.x + mx * speed * dt;
  let ny = player.y + my * speed * dt;
  const fixed = collideBuildings(world, nx, ny, PLAYER.radius);
  nx = fixed.x;
  ny = fixed.y;
  const clamped = clampToWorld(nx, ny, PLAYER.radius + 4);
  player.x = clamped.x;
  player.y = clamped.y;
  if (len > 0 && input.run) {
    player.runDust -= dt;
    if (player.runDust <= 0) {
      player.runDust = 0.12;
      world.particles.push({ x: player.x, y: player.y + 10, vx: 0, vy: 0, life: 0.4, max: 0.4, size: 5, color: '#d8c9a8', kind: 'dust' });
    }
  }

  if (input.action) {
    const car = nearestCar(world, player.x, player.y);
    if (car) {
      enterCar(world, player, car, events);
    }
  }

  if (input.shoot && player.shootCooldown <= 0) {
    fireBullet(world, player, events);
  }
}

function stepDriving(world, player, input, dt, events) {
  const car = player.inCar;
  if (!car) {
    player.onFoot = true;
    return;
  }
  const forward = input.y < 0 ? 1 : 0;
  const reverse = input.y > 0 ? 1 : 0;
  const steering = input.x;
  if (forward) car.speed += CAR.accel * dt;
  if (reverse) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  }
  if (!forward && !reverse) car.speed -= Math.sign(car.speed) * CAR.drag * 120 * dt;
  if (input.shootHeld) car.speed -= Math.sign(car.speed) * CAR.handbrakeDrag * 120 * dt;
  if (Math.abs(car.speed) < 6 && !forward && !reverse) car.speed = 0;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const turn = steering * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25) * Math.sign(car.speed || 1);
  car.angle += turn;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Move one axis at a time so the car slides along a building wall instead
  // of stopping dead against it.
  const hitX = carHitsBuilding(world, nx, car.y);
  const hitY = carHitsBuilding(world, car.x, ny);
  if (!hitX) car.x = nx;
  if (!hitY) car.y = ny;
  if (hitX && hitY) {
    if (Math.abs(car.speed) > 350 && player.crashCooldown <= 0) {
      damagePlayer(world, player, 3, events);
      events.push({ type: 'crash' });
      player.crashCooldown = 0.6;
    }
    car.speed *= -0.25;
  } else if (hitX || hitY) {
    car.speed *= 0.92;
  }
  resolveCarBuildings(world, car);
  const clamped = clampToWorld(car.x, car.y, 30);
  car.x = clamped.x;
  car.y = clamped.y;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  // Hitting a pedestrian at speed is a crime, and it costs wanted stars.
  for (const ped of world.peds) {
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30 && Math.abs(car.speed) > 60) {
      ped.x += (ped.x - car.x) * 0.4 + (world.rng() - 0.5) * 40;
      ped.y += (ped.y - car.y) * 0.4 + (world.rng() - 0.5) * 40;
      ped.panic = 3;
      addWanted(player, WANTED.hitPed);
      car.speed *= 0.6;
      events.push({ type: 'hitped' });
    }
  }
  if (input.action) {
    exitCar(world, player, events);
  }
}

function enterCar(world, player, car, events) {
  player.inCar = car;
  player.onFoot = false;
  car.parked = false;
  car.speed = 0;
  addWanted(player, WANTED.steal);
  events.push({ type: 'steal', car });
}

function exitCar(world, player, events) {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  player.onFoot = true;
  const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  const fixed = collideBuildings(world, sideX, sideY, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  car.speed = 0;
  events.push({ type: 'exit' });
}

export function addWanted(player, amount) {
  if (player.crimeCooldown > 0) return;
  player.wanted = Math.min(WANTED.max, player.wanted + amount);
  player.wantedCooldown = WANTED.decaySeconds;
  player.crimeCooldown = 1.2;
}

function fireBullet(world, player, events) {
  player.shootCooldown = PLAYER.shootCooldown;
  const a = player.angle;
  world.bullets.push({
    x: player.x + Math.cos(a) * 20,
    y: player.y + Math.sin(a) * 20,
    vx: Math.cos(a) * PLAYER.bulletSpeed,
    vy: Math.sin(a) * PLAYER.bulletSpeed,
    life: 0.9,
    friendly: true,
  });
  addWanted(player, WANTED.shoot);
  events.push({ type: 'shot' });
  for (const ped of world.peds) {
    if (Math.hypot(ped.x - player.x, ped.y - player.y) < 260) ped.panic = 2.5;
  }
}

export function damagePlayer(world, player, amount, events) {
  if (player.busted || player.wasted) return;
  player.hp -= amount;
  player.lastDamageAt = world.time;
  events.push({ type: 'hurt', amount });
  if (player.hp <= 0) {
    player.hp = 0;
    player.wasted = true;
    events.push({ type: 'wasted' });
  }
}

// A bust only ever starts while the player is stopped (or on foot) and a cop
// is right on top of them — never while a car is moving fast.
function updateBust(world, player, dt, events) {
  if (player.busted || player.wasted) return;
  const moving = speedOf(player);
  let copNear = false;
  for (const cop of world.cops) {
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (d < PLAYER.bustRadius) copNear = true;
  }
  if (copNear && moving < PLAYER.bustSpeed) {
    player.bustTimer += dt;
    if (player.bustTimer >= PLAYER.bustSeconds) {
      player.busted = true;
      events.push({ type: 'busted' });
    }
  } else {
    player.bustTimer = Math.max(0, player.bustTimer - dt * 2);
  }
}
