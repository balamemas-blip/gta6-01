// Bahia Verde Heat — the city: roads, blocks, buildings, traffic and pedestrians.
// The layout is a fixed grid (so missions are always reachable) and the
// decoration inside each block is seeded, so the same seed builds the same city.
import { WORLD, COLORS, PLACES } from './config.js';
import { makeRng, pick, range, int } from './random.js';

export const KIND_CIVILIAN = 'civilian';
export const KIND_POLICE = 'police';
export const KIND_RIVAL = 'rival';

const CAR_COLORS = ['#d84a4a', '#4a7fd8', '#e8c832', '#e8e8e8', '#3a3a3a', '#7fb54a', '#c97fb5', '#e08a3a'];
const PED_COLORS = ['#e86a6a', '#6a9ae8', '#e8c96a', '#7ac98a', '#c97ad8', '#e8a06a', '#6ad8c9'];

function roadLines() {
  const xs = [];
  const ys = [];
  for (let x = WORLD.firstRoad; x <= WORLD.width - 100; x += WORLD.roadGap) xs.push(x);
  for (let y = WORLD.firstRoad; y <= WORLD.height - 200; y += WORLD.roadGap) ys.push(y);
  return { xs, ys };
}

// True when (x, y) sits on a road (including the road's sidewalk edge).
export function onRoad(x, y) {
  const { xs, ys } = roadLines();
  const half = WORLD.roadWidth / 2 + 14;
  for (const rx of xs) if (Math.abs(x - rx) < half) return true;
  for (const ry of ys) if (Math.abs(y - ry) < half) return true;
  return false;
}

function nearestRoadCoord(value) {
  const { xs } = roadLines();
  let best = xs[0];
  for (const rx of xs) if (Math.abs(rx - value) < Math.abs(best - value)) best = rx;
  return best;
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const { xs, ys } = roadLines();
  const buildings = [];
  const palms = [];
  const parks = [];
  // One building (or park, or empty lot) per block between the roads.
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + WORLD.roadWidth / 2 + 18;
      const y0 = ys[j] + WORLD.roadWidth / 2 + 18;
      const x1 = xs[i + 1] - WORLD.roadWidth / 2 - 18;
      const y1 = ys[j + 1] - WORLD.roadWidth / 2 - 18;
      if (y0 > WORLD.beachY - 60) continue;
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 3; p += 1) {
          palms.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20) });
        }
        continue;
      }
      const w = range(rng, 110, x1 - x0 - 30);
      const h = range(rng, 90, y1 - y0 - 30);
      const bx = x0 + range(rng, 0, Math.max(1, x1 - x0 - w));
      const by = y0 + range(rng, 0, Math.max(1, y1 - y0 - h));
      buildings.push({
        x: bx, y: by, w, h,
        color: pick(rng, COLORS.buildingRoof),
        roof: rng() < 0.5 ? 'flat' : 'pitched',
        windows: int(rng, 2, 5),
      });
      if (rng() < 0.5) palms.push({ x: bx + w + 14, y: by + 10 });
    }
  }
  // Beach palms along the sand.
  for (let x = 120; x < WORLD.width - 100; x += 180) {
    palms.push({ x: x + range(rng, -30, 30), y: WORLD.beachY + range(rng, 8, 44) });
  }

  const cars = [];
  // Parked cars along the roads, plus a few drivable ones near the start.
  for (let n = 0; n < 26; n += 1) {
    const vertical = rng() < 0.5;
    const road = vertical ? pick(rng, xs) : pick(rng, ys);
    const along = range(rng, 260, WORLD.height - 320);
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? road + side * 26 : along;
    const y = vertical ? along : road + side * 26;
    if (y > WORLD.beachY) continue;
    cars.push(makeCar(cars.length, x, y, vertical ? Math.PI / 2 : 0, pick(rng, CAR_COLORS), KIND_CIVILIAN, rng));
  }
  // Starter cars sit ON the roads, facing along them, so they can actually
  // drive away: one by the player's spawn, for job 1.
  cars.push(makeCar(cars.length, PLACES.start.x - 20, PLACES.start.y + 40, -Math.PI / 2, '#e8c832', KIND_CIVILIAN, rng));
  cars.push(makeCar(cars.length, PLACES.start.x - 20, PLACES.start.y + 240, Math.PI / 2, '#4a7fd8', KIND_CIVILIAN, rng));

  const peds = [];
  for (let n = 0; n < 42; n += 1) {
    const vertical = rng() < 0.5;
    const road = vertical ? pick(rng, xs) : pick(rng, ys);
    const along = range(rng, 240, WORLD.height - 300);
    peds.push({
      id: n,
      x: vertical ? road + (rng() < 0.5 ? -44 : 44) : along,
      y: vertical ? along : road + (rng() < 0.5 ? -44 : 44),
      angle: rng() * Math.PI * 2,
      speed: range(rng, 34, 62),
      color: pick(rng, PED_COLORS),
      panic: 0,
      walkPhase: rng() * 6,
    });
  }

  const traffic = [];
  for (let n = 0; n < 14; n += 1) {
    traffic.push(spawnTrafficCar(n, rng));
  }

  return {
    rng,
    seed,
    buildings,
    palms,
    parks,
    cars,
    peds,
    traffic,
    bullets: [],
    rivals: [],
    cops: [],
    particles: [],
    pickups: [],
    time: 0,
  };
}

export function makeCar(id, x, y, angle, color, kind, rng) {
  return {
    id,
    x, y, angle,
    speed: 0,
    color,
    kind,
    parked: kind === KIND_CIVILIAN,
    siren: 0,
    // Traffic cars drive a road; parked cars wait to be stolen.
    axis: rng ? (rng() < 0.5 ? 'x' : 'y') : 'x',
    dir: rng ? (rng() < 0.5 ? 1 : -1) : 1,
    cruise: rng ? range(rng, 95, 150) : 120,
  };
}

function spawnTrafficCar(id, rng) {
  const { xs, ys } = roadLines();
  const vertical = rng() < 0.5;
  const road = vertical ? pick(rng, xs) : pick(rng, ys);
  const along = range(rng, 300, WORLD.height - 400);
  const lane = rng() < 0.5 ? -16 : 16;
  const car = makeCar(1000 + id, vertical ? road + lane : along, vertical ? along : road + lane,
    vertical ? Math.PI / 2 : 0, pick(rng, CAR_COLORS), KIND_CIVILIAN, rng);
  car.axis = vertical ? 'y' : 'x';
  car.dir = rng() < 0.5 ? 1 : -1;
  car.parked = false;
  car.speed = car.cruise;
  return car;
}

// Keep traffic flowing: respawn a car that left the map or got stuck.
export function refreshTraffic(world) {
  const rng = world.rng;
  for (let i = 0; i < world.traffic.length; i += 1) {
    const car = world.traffic[i];
    if (car.x < 120 || car.x > WORLD.width - 120 || car.y < 120 || car.y > WORLD.height - 120) {
      world.traffic[i] = spawnTrafficCar(car.id, rng);
    }
  }
  while (world.traffic.length < 14) world.traffic.push(spawnTrafficCar(1000 + world.traffic.length, rng));
}

// Move traffic cars along their road; at an intersection sometimes turn.
export function stepTraffic(world, dt) {
  for (const car of world.traffic) {
    const speed = car.cruise;
    let nx = car.x;
    let ny = car.y;
    if (car.axis === 'x') {
      nx += car.dir * speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      ny += car.dir * speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    // Near an intersection, occasionally turn onto the crossing road.
    const onX = Math.abs(nx - nearestRoadCoord(nx)) < 26;
    const onY = Math.abs(ny - nearestRoadCoord(ny)) < 26;
    if (onX && onY && world.rng() < dt * 0.35) {
      car.axis = car.axis === 'x' ? 'y' : 'x';
      car.dir = world.rng() < 0.5 ? 1 : -1;
      nx = nearestRoadCoord(nx);
      ny = nearestRoadCoord(ny);
    }
    car.x = nx;
    car.y = ny;
  }
}

// Pedestrians stroll the sidewalks; a gunshot nearby sends them running.
export function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.panic > 0) ped.panic -= dt;
    const speed = ped.panic > 0 ? ped.speed * 2.4 : ped.speed;
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    ped.walkPhase += dt * 8;
    if (ped.x < 150 || ped.x > WORLD.width - 150 || ped.y < 150 || ped.y > WORLD.height - 150) {
      ped.angle += Math.PI;
    }
    if (world.rng() < dt * 0.12) ped.angle += (world.rng() - 0.5) * 1.6;
    // Stay roughly on a sidewalk: drift back toward the nearest road line.
    if (!onRoad(ped.x, ped.y) && world.rng() < dt * 0.5) ped.angle = Math.atan2(
      nearestRoadCoord(ped.y) - ped.y, nearestRoadCoord(ped.x) - ped.x);
  }
}

// Push a circle (player, ped, bullet target) out of every building it overlaps.
export function collideBuildings(world, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * radius;
      py = cy + (dy / d) * radius;
    } else if (d2 <= 0.0001) {
      py = b.y - radius;
    }
  }
  return { x: px, y: py };
}

// True when a car-sized rectangle at (x, y, angle) overlaps a building.
// The check uses a slightly smaller box than the drawn car so it can slip
// past a building corner instead of wedging on it.
export function carHitsBuilding(world, x, y) {
  const half = 18;
  for (const b of world.buildings) {
    if (x + half > b.x && x - half < b.x + b.w && y + half > b.y && y - half < b.y + b.h) return true;
  }
  return false;
}

// Push a car out of any building its box overlaps, along the axis of least
// penetration. Without this a car can wedge exactly on a building face,
// where every move reads as blocked and it never escapes.
export function resolveCarBuildings(world, car) {
  const half = 18;
  for (const b of world.buildings) {
    const overlapX = Math.min(b.x + b.w, car.x + half) - Math.max(b.x, car.x - half);
    const overlapY = Math.min(b.y + b.h, car.y + half) - Math.max(b.y, car.y - half);
    if (overlapX <= 0 || overlapY <= 0) continue;
    if (overlapX < overlapY) {
      // Push toward the nearer face.
      if (car.x < b.x + b.w / 2) car.x = b.x - half;
      else car.x = b.x + b.w + half;
    } else {
      if (car.y < b.y + b.h / 2) car.y = b.y - half;
      else car.y = b.y + b.h + half;
    }
  }
}

export function clampToWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(WORLD.width - margin, x)),
    y: Math.max(margin, Math.min(WORLD.height - margin, y)),
  };
}
