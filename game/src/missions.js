// Solmar Heat — the five story jobs for Rosa Delgado.
// A small state machine: each job has steps, each step has a marker on
// the map and a plain-language objective. Collectibles can be taken in
// any order, and no step can soft-lock: every step completes by
// reaching a place, entering a car, or defeating visible rivals.

import { CITY_NAMES } from './config.js';
import { randomRoadPoint } from './world.js';
import { sfxJobDone, sfxPickup } from './audio.js';

export const JOBS = [
  {
    name: 'Hot Wheels',
    brief: 'Rosa needs a ride. Steal any car, then bring it to the garage.',
    reward: 500,
  },
  {
    name: 'Payday Pickup',
    brief: 'Three cash drops are waiting around Solmar. Collect them all, in any order.',
    reward: 1200,
  },
  {
    name: 'Crew Pickup',
    brief: 'Pick up Milo at the park, then drive him to the Palm Court Safehouse. The cops will notice.',
    reward: 1800,
  },
  {
    name: 'Dockside Trouble',
    brief: 'Rivals are muscling in at the Old Docks. Go on foot and settle it.',
    reward: 2200,
  },
  {
    name: 'The Big Score',
    brief: 'Hit Solmar First Bank, grab the loot, and lose the heat at the garage.',
    reward: 5000,
  },
];

export function createMissions(world) {
  const drops = [randomRoadPoint(world), randomRoadPoint(world), randomRoadPoint(world)];
  const milo = { x: world.roadXs[3], y: world.roadYs[2] };
  return {
    jobIndex: 0,
    step: 0,
    drops: drops.map((d) => ({ ...d, taken: false })),
    milo,
    rivals: [],
    lootGrabbed: false,
    message: `${CITY_NAMES.boss}: "Danny, I need a wheelman. Five jobs, good pay."`,
    messageAt: 0,
    done: false,
  };
}

export function currentObjective(m, player) {
  const job = JOBS[m.jobIndex];
  if (!job) return 'All jobs done — Solmar is yours.';
  const onFoot = player && !player.inCar;
  switch (m.jobIndex) {
    case 0:
      return m.step === 0 ? 'Steal a car (walk up to one, press E)' : `Drive the car to ${CITY_NAMES.garage}`;
    case 1: {
      const left = m.drops.filter((d) => !d.taken).length;
      return `Collect the cash drops (${3 - left}/3)`;
    }
    case 2:
      if (m.step === 0) return 'Pick up Milo at the park';
      return onFoot
        ? 'Steal a car, then drive Milo to the safehouse'
        : `Drive Milo to the ${CITY_NAMES.safehouse}`;
    case 3:
      return m.step === 0
        ? 'Get to the Old Docks on foot'
        : `Deal with the rivals (${m.rivals.filter((r) => r.hp > 0).length} left)`;
    case 4:
      if (m.step === 0) return 'Drive to Solmar First Bank';
      return onFoot
        ? 'Steal a car, then escape to the garage with the loot'
        : `Escape to ${CITY_NAMES.garage} with the loot`;
    default:
      return job.brief;
  }
}

// The nearest stealable car, as a marker: used whenever a driving step
// finds the player on foot, so the job never strands them.
function nearestCarMarker(player, cars) {
  if (!player || !cars) return [];
  let best = null;
  let bestD = Infinity;
  for (const car of cars) {
    if (car.isCop || car.occupied) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best ? [{ x: best.x, y: best.y, label: 'E', kind: 'goal' }] : [];
}

// Markers the HUD and minimap draw: {x, y, label, kind}.
export function missionMarkers(m, world, player, cars) {
  switch (m.jobIndex) {
    case 0:
      if (m.step === 0) {
        // Point at the nearest stealable car so the first job never
        // leaves the player wandering.
        return nearestCarMarker(player, cars);
      }
      return [{ x: world.garage.x, y: world.garage.y, label: 'Garage', kind: 'goal' }];
    case 1:
      return m.drops.filter((d) => !d.taken).map((d) => ({ x: d.x, y: d.y, label: '$', kind: 'cash' }));
    case 2:
      if (m.step === 0) return [{ x: m.milo.x, y: m.milo.y, label: 'Milo', kind: 'person' }];
      if (player && !player.inCar) return nearestCarMarker(player, cars);
      return [{ x: world.safehouse.x, y: world.safehouse.y, label: 'Safehouse', kind: 'goal' }];
    case 3:
      return m.step === 0
        ? [{ x: world.docks.x, y: world.docks.y, label: 'Docks', kind: 'goal' }]
        : m.rivals.filter((r) => r.hp > 0).map((r) => ({ x: r.x, y: r.y, label: '!', kind: 'rival' }));
    case 4:
      if (m.step === 0) return [{ x: world.bank.x, y: world.bank.y, label: 'Bank', kind: 'goal' }];
      if (player && !player.inCar) return nearestCarMarker(player, cars);
      return [{ x: world.garage.x, y: world.garage.y, label: 'Garage', kind: 'goal' }];
    default:
      return [];
  }
}

function near(player, x, y, dist) {
  return Math.hypot(player.x - x, player.y - y) < dist;
}

function finishJob(m, player) {
  const job = JOBS[m.jobIndex];
  player.cash += job.reward;
  sfxJobDone();
  m.jobIndex += 1;
  m.step = 0;
  m.lootGrabbed = false;
  if (m.jobIndex >= JOBS.length) {
    m.done = true;
    m.message = `${CITY_NAMES.boss}: "That's the whole list, Danny. Solmar is ours."`;
    return { event: 'won' };
  }
  m.message = `${CITY_NAMES.boss}: "${JOBS[m.jobIndex].brief}"`;
  return { event: 'jobDone', job: job.name, reward: job.reward };
}

// Runs every frame. Returns { event, wanted } — wanted is the level
// this job demands right now (0 when the job wants no heat).
export function updateMissions(m, player, world, dt) {
  let wanted = 0;
  if (m.done) return { event: null, wanted: 0 };
  switch (m.jobIndex) {
    case 0:
      if (m.step === 0 && player.inCar) {
        m.step = 1;
        m.message = 'Nice wheels. Now bring it to the garage.';
      } else if (m.step === 1 && player.inCar && near(player, world.garage.x, world.garage.y, 70)) {
        return { ...finishJob(m, player), wanted: 0 };
      }
      break;
    case 1: {
      for (const d of m.drops) {
        if (!d.taken && near(player, d.x, d.y, 46)) {
          d.taken = true;
          player.cash += 150;
          sfxPickup();
          m.message = `Cash drop collected (+$150). ${m.drops.filter((x) => !x.taken).length} left.`;
        }
      }
      if (m.drops.every((d) => d.taken)) return { ...finishJob(m, player), wanted: 0 };
      break;
    }
    case 2:
      if (m.step === 0 && near(player, m.milo.x, m.milo.y, 60)) {
        m.step = 1;
        m.message = 'Milo: "Step on it — I hear sirens already."';
      } else if (m.step === 1 && player.inCar && near(player, world.safehouse.x, world.safehouse.y, 70)) {
        return { ...finishJob(m, player), wanted: 0 };
      }
      if (m.step === 1) wanted = 2;
      break;
    case 3:
      if (m.step === 0 && !player.inCar && near(player, world.docks.x, world.docks.y, 70)) {
        m.step = 1;
        m.rivals = [
          { x: world.docks.x - 70, y: world.docks.y - 40, hp: 3, shootAt: 0 },
          { x: world.docks.x + 60, y: world.docks.y - 60, hp: 3, shootAt: 0 },
          { x: world.docks.x - 40, y: world.docks.y + 70, hp: 3, shootAt: 0 },
          { x: world.docks.x + 80, y: world.docks.y + 50, hp: 3, shootAt: 0 },
        ];
        m.message = 'Rivals at the docks! Space to shoot.';
      } else if (m.step === 1 && m.rivals.length > 0 && m.rivals.every((r) => r.hp <= 0)) {
        return { ...finishJob(m, player), wanted: 0 };
      }
      if (m.step === 1) wanted = 1;
      break;
    case 4:
      if (m.step === 0 && near(player, world.bank.x, world.bank.y, 70)) {
        m.step = 1;
        m.lootGrabbed = true;
        m.message = 'Loot grabbed! Lose the cops and get to the garage.';
      } else if (m.step === 1 && player.inCar && near(player, world.garage.x, world.garage.y, 70)) {
        return { ...finishJob(m, player), wanted: 0 };
      }
      if (m.step === 1) wanted = 3;
      break;
    default:
      break;
  }
  return { event: null, wanted };
}
