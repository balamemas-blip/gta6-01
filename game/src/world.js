// Solmar Heat — the city of Solmar.
// A grid of roads and building blocks, a beach and sea along the south
// edge, a park at the centre, and the docks on the east side. Every
// building is a solid rectangle; every road point the game uses for
// spawns is guaranteed to sit on a road, never inside a building.

import { CONFIG, PALETTE } from './config.js';
import { mulberry32, pick, range } from './random.js';

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const W = CONFIG.world;
  const buildings = [];
  const parks = [];
  const roadXs = [];
  const roadYs = [];

  // Vertical roads: x centres of the road strips.
  for (let x = W.road / 2; x < W.width; x += W.block + W.road) roadXs.push(x);
  // Horizontal roads: y centres.
  for (let y = W.road / 2; y < W.height - W.beachHeight; y += W.block + W.road) roadYs.push(y);

  // One building per block, inset from the road by a sidewalk margin.
  const inset = 16;
  for (let i = 0; i < roadXs.length - 1; i++) {
    for (let j = 0; j < roadYs.length - 1; j++) {
      const x0 = roadXs[i] + W.road / 2 + inset;
      const y0 = roadYs[j] + W.road / 2 + inset;
      const w = W.block - inset * 2;
      const h = W.block - inset * 2;
      // The central block is the park, not a building.
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      const centreX = W.width / 2;
      const centreY = (W.height - W.beachHeight) / 2;
      if (Math.abs(cx - centreX) < W.block && Math.abs(cy - centreY) < W.block) {
        parks.push({ x: x0, y: y0, w, h });
        continue;
      }
      buildings.push({
        x: x0,
        y: y0,
        w: range(rng, w * 0.55, w),
        h: range(rng, h * 0.55, h),
        roof: pick(rng, PALETTE.buildingRoof),
        shade: rng() * 0.5,
      });
    }
  }

  const beach = { x: 0, y: W.height - W.beachHeight, w: W.width, h: W.beachHeight };
  const sea = { x: 0, y: W.height - 26, w: W.width, h: 26 };

  // Landmarks, all placed on roads.
  const garage = { x: roadXs[1], y: roadYs[1], label: "Delgado's Garage" };
  const bank = { x: roadXs[roadXs.length - 2], y: roadYs[1], label: 'Solmar First Bank' };
  const docks = { x: roadXs[roadXs.length - 1], y: roadYs[roadYs.length - 1], label: 'Old Docks' };
  const safehouse = { x: roadXs[1], y: roadYs[roadYs.length - 1], label: 'Palm Court Safehouse' };
  const spawn = { x: roadXs[2], y: roadYs[2] };

  return { seed, rng, buildings, parks, roadXs, roadYs, beach, sea, garage, bank, docks, safehouse, spawn };
}

export function isOnRoad(world, x, y) {
  const W = CONFIG.world;
  if (y > W.height - W.beachHeight) return false;
  const onV = world.roadXs.some((rx) => Math.abs(x - rx) <= W.road / 2);
  const onH = world.roadYs.some((ry) => Math.abs(y - ry) <= W.road / 2);
  return onV || onH;
}

// A random point on a road (used for car / pedestrian / pickup spawns).
// `vertical` forces the point onto a north-south road (true) or an
// east-west road (false); left out, it picks either. A car spawned on a
// north-south road must drive north or south — never across the block —
// so callers that spawn cars pass the orientation they will drive.
export function randomRoadPoint(world, vertical) {
  const rng = world.rng;
  const W = CONFIG.world;
  const northSouth = vertical === undefined ? rng() < 0.5 : vertical;
  if (northSouth) {
    const rx = pick(rng, world.roadXs);
    return { x: rx + range(rng, -W.road / 2 + 14, W.road / 2 - 14), y: range(rng, 60, W.height - W.beachHeight - 60) };
  }
  const ry = pick(rng, world.roadYs);
  return { x: range(rng, 60, W.width - 60), y: ry + range(rng, -W.road / 2 + 14, W.road / 2 - 14) };
}

// True when a circle at (x, y) with radius r overlaps any building.
export function circleHitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Push a circle out of every building it overlaps. Returns true if it hit.
export function collideBuildings(world, body) {
  let hit = false;
  for (const b of world.buildings) {
    const nx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nx;
    const dy = body.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.r * body.r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        body.x = nx + (dx / d) * body.r;
        body.y = ny + (dy / d) * body.r;
      } else {
        body.y = b.y - body.r; // centre inside: shove up out of the roof
      }
    }
  }
  return hit;
}

export function clampToWorld(body) {
  const W = CONFIG.world;
  body.x = Math.max(body.r, Math.min(W.width - body.r, body.x));
  body.y = Math.max(body.r, Math.min(W.height - body.r, body.y));
}
