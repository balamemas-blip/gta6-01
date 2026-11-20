// Bahia Verde Heat — the police: patrol cars that chase the player and
// foot cops who close in on foot. Spawn counts follow the wanted level.
import { WORLD, CAR } from './config.js';
import { makeCar, KIND_POLICE, carHitsBuilding, resolveCarBuildings, clampToWorld } from './world.js';
import { damagePlayer } from './player.js';

function spawnCopCar(world, player) {
  const rng = world.rng;
  const a = rng() * Math.PI * 2;
  const d = 620 + rng() * 260;
  const x = player.x + Math.cos(a) * d;
  const y = player.y + Math.sin(a) * d;
  const car = makeCar(2000 + world.cops.length, Math.max(140, Math.min(WORLD.width - 140, x)),
    Math.max(140, Math.min(WORLD.height - 140, y)), 0, '#1c2733', KIND_POLICE, rng);
  car.parked = false;
  car.speed = 0;
  car.siren = 0;
  car.foot = false;
  world.cops.push(car);
  return car;
}

function spawnFootCop(world, player) {
  const rng = world.rng;
  const a = rng() * Math.PI * 2;
  const d = 300 + rng() * 160;
  const cop = {
    id: 3000 + world.cops.length,
    x: Math.max(140, Math.min(WORLD.width - 140, player.x + Math.cos(a) * d)),
    y: Math.max(140, Math.min(WORLD.height - 140, player.y + Math.sin(a) * d)),
    angle: 0,
    speed: 0,
    foot: true,
    color: '#1c2733',
  };
  world.cops.push(cop);
  return cop;
}

export function stepPolice(world, player, dt, events) {
  const wanted = player.wanted;
  const wantCars = wanted === 0 ? 0 : Math.min(1 + wanted, 5);
  const cars = world.cops.filter((c) => !c.foot);
  const feet = world.cops.filter((c) => c.foot);
  // Spawn patrol cars up to the wanted level's count.
  if (cars.length < wantCars && world.rng() < dt * 0.9) spawnCopCar(world, player);
  // Foot cops only when the player is on foot and the heat is on.
  if (player.onFoot && wanted >= 2 && feet.length < wanted - 1 && world.rng() < dt * 0.8) {
    spawnFootCop(world, player);
  }
  // Drop extra cops once the heat dies down.
  if (cars.length > wantCars && world.rng() < dt * 0.5) {
    const idx = world.cops.findIndex((c) => !c.foot);
    if (idx >= 0) world.cops.splice(idx, 1);
  }
  if (wanted === 0 && feet.length > 0 && world.rng() < dt * 0.5) {
    const idx = world.cops.findIndex((c) => c.foot);
    if (idx >= 0) world.cops.splice(idx, 1);
  }

  for (const cop of world.cops) {
    cop.siren += dt;
    if (cop.foot) stepFootCop(world, player, cop, dt, events);
    else stepCopCar(world, player, cop, dt, events);
  }
}

function stepCopCar(world, player, cop, dt, events) {
  const targetAngle = Math.atan2(player.y - cop.y, player.x - cop.x);
  let diff = targetAngle - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const topSpeed = CAR.maxSpeed * (0.72 + player.wanted * 0.04);
  cop.speed = Math.min(topSpeed, cop.speed + CAR.accel * 0.8 * dt);
  cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
  const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
  if (carHitsBuilding(world, nx, ny)) {
    // Slide around the block instead of ramming it forever.
    cop.angle += 1.2 * dt * 4;
    cop.speed *= 0.6;
  } else {
    cop.x = nx;
    cop.y = ny;
  }
  resolveCarBuildings(world, cop);
  const clamped = clampToWorld(cop.x, cop.y, 30);
  cop.x = clamped.x;
  cop.y = clamped.y;
  // Ram the player's car: damage on a hard hit (at most once a second),
  // and slow them both down.
  if (player.inCar) {
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (d < 42 && cop.speed > 120 && player.ramCooldown <= 0) {
      damagePlayer(world, player, 4, events);
      player.ramCooldown = 1.5;
      cop.speed *= 0.25;
      player.inCar.speed *= 0.7;
      events.push({ type: 'ram' });
      world.particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 9, color: '#ffd23e', kind: 'spark' });
    }
  }
}

function stepFootCop(world, player, cop, dt, events) {
  const d = Math.hypot(player.x - cop.x, player.y - cop.y);
  if (d > 520) return;
  cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
  const speed = 150;
  cop.x += Math.cos(cop.angle) * speed * dt;
  cop.y += Math.sin(cop.angle) * speed * dt;
  // A foot cop who reaches the player on foot starts shoving them down.
  if (player.onFoot && d < 30) {
    damagePlayer(world, player, 6 * dt, events);
  }
}
