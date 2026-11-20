// Solmar Heat — the Solmar police.
// Wanted stars call cops in. Cops chase, ram, and — only when the
// player is stopped or on foot — hold them for a bust. A fast-moving
// car can never be busted, and cop top speed is capped below the
// player's, so escape is always possible.

import { CONFIG } from './config.js';
import { collideBuildings } from './world.js';
import { hurtPlayer } from './player.js';
import { sfxBusted, sfxCrash, sfxSiren } from './audio.js';

export function createPolice() {
  return { cops: [], bustTimer: 0, sirenAt: 0 };
}

export function wantedTarget(police) {
  return Math.min(CONFIG.cop.maxActive, police.cops.length);
}

export function updatePolice(police, player, world, wanted, dt, time) {
  const desired = wanted === 0 ? 0 : Math.min(1 + wanted, CONFIG.cop.maxActive);
  // Spawn reinforcements at the map edge, away from the player.
  while (police.cops.length < desired) {
    const edge = Math.floor(world.rng() * 4);
    const W = CONFIG.world;
    const x = edge === 0 ? 60 : edge === 1 ? W.width - 60 : player.x + (world.rng() < 0.5 ? -500 : 500);
    const y = edge === 2 ? 60 : edge === 3 ? W.height - W.beachHeight - 60 : player.y + (world.rng() < 0.5 ? -400 : 400);
    police.cops.push({
      x: Math.max(40, Math.min(W.width - 40, x)),
      y: Math.max(40, Math.min(W.height - 60, y)),
      angle: 0,
      speed: 0,
      ramAt: -99,
    });
  }
  while (police.cops.length > desired) police.cops.pop();

  if (wanted > 0 && time - police.sirenAt > 6) {
    police.sirenAt = time;
    sfxSiren();
  }

  let nearest = Infinity;
  for (const cop of police.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    nearest = Math.min(nearest, dist);
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    cop.speed = Math.min(CONFIG.cop.topSpeed, cop.speed + CONFIG.cop.accel * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Cops chase across the city but never through buildings: they
    // slide around a block instead of driving over its roof.
    const body = { x: cop.x, y: cop.y, r: 20 };
    if (collideBuildings(world, body)) {
      cop.x = body.x;
      cop.y = body.y;
      cop.speed *= 0.85;
    }
    // A ram hurts and shoves, on a cooldown so it never stunlocks.
    if (dist < 44 && time - cop.ramAt > CONFIG.cop.ramCooldownSec) {
      cop.ramAt = time;
      hurtPlayer(player, CONFIG.cop.ramDamage, time);
      cop.speed *= 0.5;
      sfxCrash();
    }
  }

  // Bust: only while the player is stopped (or on foot) and a cop is
  // right on top of them. A moving car is never busted.
  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.moving ? 200 : 0;
  if (wanted > 0 && nearest < CONFIG.cop.bustRadius && playerSpeed < 12) {
    police.bustTimer += dt;
    if (police.bustTimer >= CONFIG.cop.bustHoldSec) {
      sfxBusted();
      return 'busted';
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }
  return null;
}

export function bustProgress(police) {
  return Math.min(1, police.bustTimer / CONFIG.cop.bustHoldSec);
}
