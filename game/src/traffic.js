// Solmar Heat — traffic cars and pedestrians.
// Traffic cars cruise the road grid on simple loops; pedestrians stroll
// the sidewalks and scatter when a car barrels at them. Both are
// ambience with collision: traffic is something to dodge, not scenery.

import { CONFIG, PALETTE } from './config.js';
import { pick, range } from './random.js';
import { randomRoadPoint, collideBuildings } from './world.js';

export function spawnTrafficCar(world, rng) {
  const vertical = rng() < 0.5;
  const p = randomRoadPoint(world, vertical); // point matches the heading
  return {
    x: p.x,
    y: p.y,
    angle: vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : rng() < 0.5 ? 0 : Math.PI,
    speed: range(rng, 55, 95),
    color: pick(rng, PALETTE.carColors),
    isCop: false,
    occupied: false,
    parked: rng() < 0.35, // some cars sit parked at the kerb, ready to steal
    length: CONFIG.car.length,
    width: CONFIG.car.width,
  };
}

export function createTraffic(world, count) {
  const cars = [];
  for (let i = 0; i < count; i++) cars.push(spawnTrafficCar(world, world.rng));
  // Two getaway-ready cars parked right by the garage, on the road.
  for (const dy of [-60, 60]) {
    cars.push({
      x: world.garage.x + 40,
      y: world.garage.y + dy,
      angle: 0,
      speed: 0,
      color: '#d64545',
      isCop: false,
      occupied: false,
      parked: true,
      length: CONFIG.car.length,
      width: CONFIG.car.width,
    });
  }
  return cars;
}

export function updateTrafficCar(car, world, dt) {
  if (car.parked || car.occupied) return;
  const W = CONFIG.world;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // At a junction, sometimes turn; at the map edge, turn around.
  const nearJunction =
    world.roadXs.some((rx) => Math.abs(car.x - rx) < 8) &&
    world.roadYs.some((ry) => Math.abs(car.y - ry) < 8);
  if (nearJunction && world.rng() < dt * 0.5) {
    car.angle += (world.rng() < 0.5 ? 1 : -1) * (Math.PI / 2);
  }
  if (car.x < 40 || car.x > W.width - 40 || car.y < 40 || car.y > W.height - W.beachHeight - 40) {
    car.angle += Math.PI;
    car.x = Math.max(40, Math.min(W.width - 40, car.x));
    car.y = Math.max(40, Math.min(W.height - W.beachHeight - 40, car.y));
  }
}

export function createPedestrians(world, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(world);
    peds.push({
      x: p.x,
      y: p.y,
      angle: world.rng() * Math.PI * 2,
      speed: range(world.rng, 22, 42),
      hue: Math.floor(world.rng() * 360),
      flee: 0,
    });
  }
  return peds;
}

export function updatePedestrian(ped, player, world, dt) {
  const d = Math.hypot(ped.x - player.x, ped.y - player.y);
  if (d < 120 && player.inCar && Math.abs(player.inCar.speed) > 60) ped.flee = 1.5;
  if (ped.flee > 0) {
    ped.flee -= dt;
    ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
    ped.x += Math.cos(ped.angle) * 95 * dt;
    ped.y += Math.sin(ped.angle) * 95 * dt;
  } else {
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (Math.random() < dt * 0.2) ped.angle += (Math.random() - 0.5) * 1.6;
  }
  ped.x = Math.max(20, Math.min(CONFIG.world.width - 20, ped.x));
  ped.y = Math.max(20, Math.min(CONFIG.world.height - 60, ped.y));
  const body = { x: ped.x, y: ped.y, r: 11 };
  if (collideBuildings(world, body)) {
    ped.x = body.x;
    ped.y = body.y;
    ped.angle += Math.PI / 2;
  }
}
