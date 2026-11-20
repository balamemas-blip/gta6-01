// Solmar Heat — world: the city itself. Buildings from the road grid,
// parked cars, traffic that drives the roads, pedestrians on the sidewalks
// and the police cars that chase the player. All positions come from the
// seeded generator, so a fixed seed builds the same city every time.

import { WORLD, TUNING, COLORS } from './config.js';
import { pick, range, intRange, clamp, dist, angleTo, angleDiff } from './random.js';

const CAR_COLORS = ['#7fb3d5', '#d5a97f', '#9fd5a8', '#d57f7f', '#c9c9c9', '#8f7fd5', '#e8e06a'];
const PED_SHIRTS = ['#e86a6a', '#6aa8e8', '#7fd57f', '#e8d06a', '#c96ae8', '#f2e6c9'];

// --- City layout -----------------------------------------------------------

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const xs = WORLD.roadsX;
  const ys = WORLD.roadsY;
  const roofColors = [COLORS.buildingRoof, COLORS.buildingRoof2, COLORS.buildingRoof3];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + WORLD.roadHalf + 36;
      const x1 = xs[i + 1] - WORLD.roadHalf - 36;
      const y0 = ys[j] + WORLD.roadHalf + 36;
      const y1 = ys[j + 1] - WORLD.roadHalf - 36;
      if (y0 > WORLD.beachY - 60) continue; // beach strip stays open
      // Plaza del Sol: one open block in the middle.
      if (xs[i] === 1440 && ys[j] === 1120) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      if (rng() < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (rng() < 0.45) {
        // Two smaller buildings side by side.
        const gap = 14;
        const w2 = (bw - gap) / 2;
        buildings.push({ x: x0, y: y0 + 8, w: w2, h: bh - 16, color: pick(rng, roofColors) });
        buildings.push({ x: x0 + w2 + gap, y: y0 + 8, w: w2, h: bh - 16, color: pick(rng, roofColors) });
      } else {
        buildings.push({ x: x0 + 6, y: y0 + 6, w: bw - 12, h: bh - 12, color: pick(rng, roofColors) });
      }
    }
  }
  return { buildings, parks };
}

// Circle vs building rectangles: push the circle out. Returns true on hit.
export function collideBuildings(buildings, obj, radius) {
  return !!collideBuildingsInfo(buildings, obj, radius);
}

// Same push-out, but also returns the hit: the building and the outward
// normal (nx, ny) of the deepest overlap, so a car can slide along a wall
// instead of grinding into it. Returns null when nothing was hit.
export function collideBuildingsInfo(buildings, obj, radius) {
  let best = null;
  for (const b of buildings) {
    const cx = clamp(obj.x, b.x, b.x + b.w);
    const cy = clamp(obj.y, b.y, b.y + b.h);
    const dx = obj.x - cx;
    const dy = obj.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      const depth = radius - Math.sqrt(d2);
      if (!best || depth > best.depth) {
        let nx = 0;
        let ny = -1;
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
        }
        best = { b, nx, ny, depth };
      }
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        obj.x = cx + (dx / d) * radius;
        obj.y = cy + (dy / d) * radius;
      } else {
        obj.y = b.y - radius;
      }
    }
  }
  return best;
}

export function pointInBuilding(buildings, x, y) {
  for (const b of buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

// --- Cars ------------------------------------------------------------------

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color,
    kind: kind || 'traffic', // traffic | parked | police | player
    hp: kind === 'police' ? 60 : 100,
    stuck: 0,
  };
}

// Parked cars along curbs, clear of mission markers and the spawn point.
export function createParkedCars(rng, buildings) {
  const cars = [];
  const spots = [];
  for (const rx of WORLD.roadsX) {
    for (const ry of WORLD.roadsY) {
      spots.push({ x: rx + WORLD.roadHalf + 16, y: ry + 90, angle: 0 });
      spots.push({ x: rx - WORLD.roadHalf - 16, y: ry + 200, angle: Math.PI });
      spots.push({ x: rx + 120, y: ry + WORLD.roadHalf + 16, angle: Math.PI / 2 });
      spots.push({ x: rx + 260, y: ry - WORLD.roadHalf - 16, angle: -Math.PI / 2 });
    }
  }
  for (const s of spots) {
    if (rng() < 0.55) continue;
    if (pointInBuilding(buildings, s.x, s.y)) continue;
    if (dist(s.x, s.y, 480, 1440) < 120) continue; // keep spawn clear
    cars.push(makeCar(s.x, s.y, s.angle, pick(rng, CAR_COLORS), 'parked'));
    if (cars.length >= 26) break;
  }
  return cars;
}

export function createTraffic(rng) {
  const cars = [];
  for (let i = 0; i < TUNING.trafficCount; i++) {
    const horizontal = rng() < 0.5;
    const road = horizontal
      ? pick(rng, WORLD.roadsY)
      : pick(rng, WORLD.roadsX);
    const along = range(rng, 80, horizontal ? WORLD.w - 80 : WORLD.h - 120);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = (rng() < 0.5 ? -1 : 1) * 13;
    const car = makeCar(
      horizontal ? along : road + lane,
      horizontal ? road + lane : along,
      horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      pick(rng, CAR_COLORS),
      'traffic',
    );
    car.speed = range(rng, 90, 150) * dir;
    car.axis = horizontal ? 'x' : 'y';
    car.road = road;
    car.dir = dir;
    cars.push(car);
  }
  return cars;
}

// Traffic drives its road; at an intersection it sometimes turns.
export function updateTraffic(cars, dt, buildings) {
  for (const c of cars) {
    const step = c.speed * dt;
    if (c.axis === 'x') c.x += step;
    else c.y += step;
    // Turn at intersections.
    const cross = c.axis === 'x' ? WORLD.roadsX : WORLD.roadsY;
    for (const r of cross) {
      const along = c.axis === 'x' ? c.x : c.y;
      if (Math.abs(along - r) < 6 && Math.random() < 0.0016) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const lane = (Math.random() < 0.5 ? -1 : 1) * 13;
        if (c.axis === 'x') {
          c.axis = 'y'; c.road = r; c.y = r + lane; c.dir = dir;
          c.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          c.speed = Math.abs(c.speed) * dir;
        } else {
          c.axis = 'x'; c.road = r; c.x = r + lane; c.dir = dir;
          c.angle = dir > 0 ? 0 : Math.PI;
          c.speed = Math.abs(c.speed) * dir;
        }
        break;
      }
    }
    // Wrap around the city edge.
    if (c.axis === 'x' && (c.x < 40 || c.x > WORLD.w - 40)) c.x = c.x < 40 ? WORLD.w - 60 : 60;
    if (c.axis === 'y' && (c.y < 40 || c.y > WORLD.h - 140)) c.y = c.y < 40 ? WORLD.h - 160 : 60;
    collideBuildings(buildings, c, 15);
  }
}

// --- Pedestrians -----------------------------------------------------------

export function createPeds(rng) {
  const peds = [];
  for (let i = 0; i < TUNING.pedCount; i++) {
    const horizontal = rng() < 0.5;
    const road = horizontal ? pick(rng, WORLD.roadsY) : pick(rng, WORLD.roadsX);
    const along = range(rng, 100, horizontal ? WORLD.w - 100 : WORLD.h - 200);
    const off = WORLD.roadHalf + 10 + rng() * 6;
    const side = rng() < 0.5 ? -1 : 1;
    peds.push({
      x: horizontal ? along : road + off * side,
      y: horizontal ? road + off * side : along,
      angle: horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rng, 28, 52),
      shirt: pick(rng, PED_SHIRTS),
      flee: 0,
      walkPhase: rng() * 6,
    });
  }
  return peds;
}

export function updatePeds(peds, dt, buildings, threat) {
  for (const p of peds) {
    p.walkPhase += dt * 6;
    const td = threat ? dist(p.x, p.y, threat.x, threat.y) : 9999;
    if (td < 130 && threat.fast) p.flee = 1.2;
    if (p.flee > 0) {
      p.flee -= dt;
      const away = angleTo(threat.x, threat.y, p.x, p.y);
      p.angle = away;
      p.x += Math.cos(away) * 95 * dt;
      p.y += Math.sin(away) * 95 * dt;
    } else {
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      // Turn around at the city edge; wander at intersections.
      if (p.x < 60 || p.x > WORLD.w - 60 || p.y < 60 || p.y > WORLD.h - 160) {
        p.angle += Math.PI;
        p.x = clamp(p.x, 60, WORLD.w - 60);
        p.y = clamp(p.y, 60, WORLD.h - 160);
      }
      if (Math.random() < 0.002) p.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    collideBuildings(buildings, p, 10);
    p.x = clamp(p.x, 30, WORLD.w - 30);
    p.y = clamp(p.y, 30, WORLD.h - 100);
  }
}

// --- Police ----------------------------------------------------------------

export function spawnPoliceCar(x, y) {
  const car = makeCar(x, y, 0, COLORS.policeCar, 'police');
  car.speed = 0;
  return car;
}

// A police car steers toward the player and rams. Returns contact seconds.
export function updatePoliceCar(car, dt, target, buildings) {
  const want = angleTo(car.x, car.y, target.x, target.y);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.3 * dt, 2.3 * dt);
  const d = dist(car.x, car.y, target.x, target.y);
  const maxSpeed = d > 700 ? 445 : 420;
  car.speed = Math.min(car.speed + 380 * dt, maxSpeed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (collideBuildings(buildings, car, 15)) car.speed *= 0.55;
  car.x = clamp(car.x, 30, WORLD.w - 30);
  car.y = clamp(car.y, 30, WORLD.h - 100);
  return d;
}

export function randomRoadPoint(rng) {
  const horizontal = rng() < 0.5;
  if (horizontal) return { x: range(rng, 120, WORLD.w - 120), y: pick(rng, WORLD.roadsY) };
  return { x: pick(rng, WORLD.roadsX), y: range(rng, 120, WORLD.h - 200) };
}

export { intRange };
