// Bahia Verde Heat — the five story jobs: objectives, progress, rewards
// and the win. Each job is one step of a small state machine; a job can
// never soft-lock, because every objective is a place or a count the player
// can always reach again.
import { MISSIONS, PLACES, PLAYER } from './config.js';
import { makeCar, KIND_CIVILIAN } from './world.js';
import { damagePlayer, nearestCar } from './player.js';

export function createMissions() {
  return {
    index: 0, // 0..4, 5 means every job done
    dropsCollected: 0,
    evadeTimer: 20,
    evadeActive: false,
    rivalsLeft: 0,
    rivalsSpawned: false,
    getawaySpawned: false,
    done: false,
    toast: '',
    toastAt: 0,
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

// The map marker the objective arrow and minimap point at right now.
export function missionTarget(world, missions, player) {
  const m = currentMission(missions);
  if (!m) return null;
  if (m.id === 1) {
    if (player.inCar) return { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Garage' };
    const car = nearestCar(world, player.x, player.y);
    if (car) return { x: car.x, y: car.y, label: 'Car' };
    return { x: PLACES.start.x + 60, y: PLACES.start.y, label: 'Car' };
  }
  if (m.id === 2) {
    const drop = PLACES.drops[missions.dropsCollected];
    if (drop) return { x: drop.x, y: drop.y, label: 'Cash drop' };
    return { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Garage' };
  }
  if (m.id === 3) return { x: player.x, y: player.y, label: 'Stay clear!' };
  if (m.id === 4) return { x: PLACES.turf.x, y: PLACES.turf.y, label: 'Rival turf' };
  if (m.id === 5) {
    if (!missions.getawaySpawned) return { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Getaway car' };
    return { x: PLACES.docks.x, y: PLACES.docks.y, label: 'Docks' };
  }
  return null;
}

export function missionProgress(missions) {
  const m = currentMission(missions);
  if (!m) return 'All jobs done — Bahia Verde is yours.';
  if (m.id === 2) return `${missions.dropsCollected} / 3 cash bags`;
  if (m.id === 3) return `Stay clear: ${Math.ceil(missions.evadeTimer)}s`;
  if (m.id === 4) return `${6 - missions.rivalsLeft} / 6 rivals down`;
  if (m.id === 5 && !missions.getawaySpawned) return 'Grab the getaway car at the garage';
  return m.brief;
}

function completeMission(world, missions, player, events) {
  const m = currentMission(missions);
  if (!m) return;
  player.cash += m.reward;
  missions.toast = `Job ${m.id} done! +$${m.reward}`;
  missions.toastAt = world.time;
  events.push({ type: 'mission', mission: m.id, reward: m.reward });
  missions.index += 1;
  missions.dropsCollected = 0;
  missions.evadeTimer = 20;
  missions.evadeActive = false;
  missions.rivalsSpawned = false;
  if (missions.index >= MISSIONS.length) {
    missions.done = true;
    events.push({ type: 'win' });
  }
}

function spawnRivals(world) {
  const rng = world.rng;
  world.rivals = [];
  for (let i = 0; i < 6; i += 1) {
    const a = rng() * Math.PI * 2;
    const d = 60 + rng() * 160;
    world.rivals.push({
      x: PLACES.turf.x + Math.cos(a) * d,
      y: PLACES.turf.y + Math.sin(a) * d,
      hp: 2,
      angle: 0,
      shootCooldown: 1 + rng(),
      color: '#7a2a8a',
      walkPhase: rng() * 6,
    });
  }
}

export function stepMissions(world, missions, player, dt, events) {
  const m = currentMission(missions);
  if (!m || missions.done) return;

  if (m.id === 1 && player.inCar) {
    const d = Math.hypot(player.x - PLACES.garage.x, player.y - PLACES.garage.y);
    if (d < 90) completeMission(world, missions, player, events);
  }

  if (m.id === 2) {
    const drop = PLACES.drops[missions.dropsCollected];
    if (drop) {
      const d = Math.hypot(player.x - drop.x, player.y - drop.y);
      if (d < 46) {
        missions.dropsCollected += 1;
        player.cash += 150;
        events.push({ type: 'pickup', what: 'cash bag' });
        world.particles.push({ x: drop.x, y: drop.y, vx: 0, vy: -30, life: 0.7, max: 0.7, size: 12, color: '#37d67a', kind: 'ring' });
        if (missions.dropsCollected >= 3) completeMission(world, missions, player, events);
      }
    }
  }

  if (m.id === 3) {
    if (!missions.evadeActive) {
      player.wanted = Math.max(player.wanted, 3);
      missions.evadeActive = true;
    }
    let nearestCop = Infinity;
    for (const cop of world.cops) {
      nearestCop = Math.min(nearestCop, Math.hypot(cop.x - player.x, cop.y - player.y));
    }
    if (nearestCop > 320 || world.cops.length === 0) {
      missions.evadeTimer -= dt;
      if (missions.evadeTimer <= 0) completeMission(world, missions, player, events);
    }
  }

  if (m.id === 4) {
    if (!missions.rivalsSpawned) {
      // The turf fight is a street fight, not a police chase: the heat
      // drops and the foot cops back off when it starts.
      player.wanted = 1;
      world.cops = world.cops.filter((c) => !c.foot);
      // A checkpoint breather before the fight: Rico patches up.
      player.hp = PLAYER.hpMax;
      spawnRivals(world);
      missions.rivalsSpawned = true;
      missions.rivalsLeft = 6;
    }
    stepRivals(world, player, dt, events);
    if (missions.rivalsLeft <= 0) completeMission(world, missions, player, events);
  }

  if (m.id === 5) {
    if (!missions.getawaySpawned) {
      const car = makeCar(777, PLACES.getawayCar.x, PLACES.getawayCar.y, 0, '#d84a4a', KIND_CIVILIAN, world.rng);
      car.parked = true;
      world.cars.push(car);
      missions.getawaySpawned = true;
      player.wanted = Math.max(player.wanted, 4);
    }
    const d = Math.hypot(player.x - PLACES.docks.x, player.y - PLACES.docks.y);
    if (player.inCar && d < 110) completeMission(world, missions, player, events);
  }
}

// Rivals strafe around the turf and shoot at the player when close.
function stepRivals(world, player, dt, events) {
  for (const rival of world.rivals) {
    if (rival.hp <= 0) continue;
    const d = Math.hypot(player.x - rival.x, player.y - rival.y);
    rival.angle = Math.atan2(player.y - rival.y, player.x - rival.x);
    rival.walkPhase += dt * 6;
    if (d > 200) {
      rival.x += Math.cos(rival.angle) * 90 * dt;
      rival.y += Math.sin(rival.angle) * 90 * dt;
    } else if (d < 110) {
      rival.x -= Math.cos(rival.angle) * 60 * dt;
      rival.y -= Math.sin(rival.angle) * 60 * dt;
    }
    rival.shootCooldown -= dt;
    if (rival.shootCooldown <= 0 && d < 380) {
      rival.shootCooldown = 1.4 + world.rng() * 1.0;
      const spread = (world.rng() - 0.5) * 0.5;
      const a = rival.angle + spread;
      world.bullets.push({
        x: rival.x + Math.cos(a) * 20,
        y: rival.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 380,
        vy: Math.sin(a) * 380,
        life: 1.1,
        friendly: false,
      });
      events.push({ type: 'enemyShot' });
    }
  }
}

// Bullets fly, hit rivals / the player / buildings, and spark out.
export function stepBullets(world, missions, player, dt, events) {
  const kept = [];
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    let hit = false;
    if (b.friendly) {
      for (const rival of world.rivals) {
        if (rival.hp > 0 && Math.hypot(rival.x - b.x, rival.y - b.y) < 18) {
          rival.hp -= PLAYER.bulletDamage;
          hit = true;
          world.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 8, color: '#ff5a5a', kind: 'spark' });
          if (rival.hp <= 0) {
            missions.rivalsLeft = Math.max(0, missions.rivalsLeft - 1);
            events.push({ type: 'rivalDown' });
          }
          break;
        }
      }
    } else {
      const d = Math.hypot(player.x - b.x, player.y - b.y);
      const radius = player.inCar ? 24 : 15;
      if (d < radius) {
        damagePlayer(world, player, 5, events);
        hit = true;
      }
    }
    if (!hit) kept.push(b);
  }
  world.bullets = kept;
}

// A first-aid kit waits at the garage for a hurt wheelman (once per 5s).
export function stepPickups(world, player, dt, events) {
  void dt;
  if (player.lastHealAt === undefined) player.lastHealAt = -99;
  const d = Math.hypot(player.x - PLACES.garage.x, player.y - PLACES.garage.y);
  if (d < 70 && player.hp < PLAYER.hpMax && player.hp > 0 && world.time - player.lastHealAt > 5) {
    player.hp = Math.min(PLAYER.hpMax, player.hp + 30);
    player.lastHealAt = world.time;
    events.push({ type: 'heal' });
  }
}
