// Bahia Verde Heat — rendering: the sun-soaked city, cars, people, effects,
// and every screen (title, play HUD with minimap, pause, wasted, busted, win).
import { WORLD, COLORS, PLACES, MISSIONS } from './config.js';
import { missionTarget, missionProgress, currentMission } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function roadXs() {
  const xs = [];
  for (let x = WORLD.firstRoad; x <= WORLD.width - 100; x += WORLD.roadGap) xs.push(x);
  return xs;
}
function roadYs() {
  const ys = [];
  for (let y = WORLD.firstRoad; y <= WORLD.height - 200; y += WORLD.roadGap) ys.push(y);
  return ys;
}

function drawGround(ctx, cam, vw, vh) {
  // Base: warm dry grass, then the beach and the sea at the south edge.
  ctx.fillStyle = '#8fb45e';
  ctx.fillRect(cam.x, cam.y, vw, vh);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(cam.x, WORLD.beachY - cam.y, vw, WORLD.height - WORLD.beachY);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(cam.x, WORLD.waterY - cam.y, vw, WORLD.height - WORLD.waterY);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = 0; x < WORLD.width; x += 260) {
    ctx.fillRect(x - cam.x, WORLD.waterY - cam.y + 8 + ((x / 260) % 2) * 10, 120, 3);
  }
  // Sidewalks: pale bands around every road.
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of roadXs()) ctx.fillRect(rx - WORLD.roadWidth / 2 - 14 - cam.x, cam.y, WORLD.roadWidth + 28, vh);
  for (const ry of roadYs()) ctx.fillRect(cam.x, ry - WORLD.roadWidth / 2 - 14 - cam.y, vw, WORLD.roadWidth + 28);
  // Asphalt.
  ctx.fillStyle = COLORS.asphalt;
  for (const rx of roadXs()) ctx.fillRect(rx - WORLD.roadWidth / 2 - cam.x, cam.y, WORLD.roadWidth, vh);
  for (const ry of roadYs()) ctx.fillRect(cam.x, ry - WORLD.roadWidth / 2 - cam.y, vw, WORLD.roadWidth);
  // Centre dashes.
  ctx.fillStyle = COLORS.asphaltLine;
  for (const rx of roadXs()) {
    for (let y = 0; y < WORLD.height; y += 64) ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 30);
  }
  for (const ry of roadYs()) {
    for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x - cam.x, ry - 2 - cam.y, 30, 4);
  }
}

function drawBuilding(ctx, cam, b) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x + 6 - cam.x, b.y + 8 - cam.y, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, 8);
  ctx.fillStyle = 'rgba(20,30,50,0.55)';
  const cols = Math.max(1, Math.floor(b.w / 34));
  const rows = Math.max(1, Math.floor(b.h / 34));
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      ctx.fillRect(b.x + 10 + i * 34 - cam.x, b.y + 14 + j * 34 - cam.y, 16, 18);
    }
  }
}

function drawPalm(ctx, cam, p, t) {
  const sway = Math.sin(t * 1.2 + p.x * 0.01) * 3;
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.x - cam.x, p.y - cam.y);
  ctx.lineTo(p.x + sway - cam.x, p.y - 26 - cam.y);
  ctx.stroke();
  ctx.fillStyle = COLORS.palm;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(p.x + sway + Math.cos(a) * 12 - cam.x, p.y - 26 + Math.sin(a) * 6 - cam.y, 13, 5, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCar(ctx, cam, car) {
  ctx.save();
  ctx.translate(car.x - cam.x, car.y - cam.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-24, -10, 48, 24);
  ctx.fillStyle = car.color;
  roundRect(ctx, -23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.75)';
  roundRect(ctx, -6, -9, 16, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(20, -8, 3, 5);
  ctx.fillRect(20, 3, 3, 5);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-23, -8, 3, 5);
  ctx.fillRect(-23, 3, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -11, 10, 22);
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('PD', -1, 3);
    const flash = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
    ctx.beginPath();
    ctx.arc(-8, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(8, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, cam, x, y, angle, color, phase, cop) {
  ctx.save();
  ctx.translate(x - cam.x, y - cam.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(phase) * 1.5;
  ctx.fillStyle = cop ? '#1c2733' : color;
  ctx.beginPath();
  ctx.arc(0, bob - 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 3, bob - 10, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (cop) {
    ctx.fillStyle = '#d8d8d8';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('PD', -5, bob + 1);
  }
  ctx.restore();
}

function drawWorld(ctx, state, cam, vw, vh) {
  const world = state.world;
  const t = world.time;
  drawGround(ctx, cam, vw, vh);
  for (const park of world.parks) {
    ctx.fillStyle = '#6da34e';
    ctx.fillRect(park.x - park.w / 2 - cam.x, park.y - park.h / 2 - cam.y, park.w, park.h);
  }
  for (const b of world.buildings) drawBuilding(ctx, cam, b);
  for (const p of world.palms) drawPalm(ctx, cam, p, t);
  // Garage and docks markers on the ground.
  drawPlaceMarker(ctx, cam, PLACES.garage.x, PLACES.garage.y, '#37d67a', 'GARAGE');
  drawPlaceMarker(ctx, cam, PLACES.docks.x, PLACES.docks.y, '#37b6d6', 'DOCKS');
  drawPlaceMarker(ctx, cam, PLACES.turf.x, PLACES.turf.y, '#b537d6', 'TURF');
  // Cash drops.
  const mission = currentMission(state.missions);
  if (mission && mission.id === 2) {
    PLACES.drops.forEach((drop, i) => {
      if (i < state.missions.dropsCollected) return;
      const pulse = 1 + Math.sin(t * 5) * 0.15;
      ctx.save();
      ctx.translate(drop.x - cam.x, drop.y - cam.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#37d67a';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
      ctx.restore();
    });
  }
  // Rivals.
  for (const rival of world.rivals) {
    if (rival.hp <= 0) continue;
    drawPerson(ctx, cam, rival.x, rival.y, rival.angle, rival.color, rival.walkPhase, false);
    ctx.fillStyle = '#222';
    ctx.fillRect(rival.x - 12 - cam.x, rival.y - 24 - cam.y, 24, 4);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(rival.x - 12 - cam.x, rival.y - 24 - cam.y, 12 * rival.hp, 4);
  }
  // Traffic and parked cars.
  for (const car of world.traffic) drawCar(ctx, cam, car);
  for (const car of world.cars) drawCar(ctx, cam, car);
  for (const cop of world.cops) {
    if (cop.foot) drawPerson(ctx, cam, cop.x, cop.y, cop.angle, '#1c2733', world.time * 8, true);
    else drawCar(ctx, cam, cop);
  }
  // Pedestrians.
  for (const ped of world.peds) {
    drawPerson(ctx, cam, ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, false);
  }
  // Bullets and particles.
  for (const b of world.bullets) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of world.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.size * a + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // The player, on foot or in a car.
  const player = state.player;
  if (!player.inCar) {
    drawPerson(ctx, cam, player.x, player.y, player.angle, '#e8b13a', world.time * 10, false);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RICO', player.x - cam.x, player.y - 22 - cam.y);
  }
  // Objective arrow at the screen edge.
  drawObjectiveArrow(ctx, state, cam, vw, vh);
}

function drawPlaceMarker(ctx, cam, x, y, color, label) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x - cam.x, y - cam.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x - cam.x, y - 18 - cam.y);
}

function drawObjectiveArrow(ctx, state, cam, vw, vh) {
  const target = missionTarget(state.world, state.missions, state.player);
  if (!target || state.missions.done) return;
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 120) return;
  const angle = Math.atan2(dy, dx);
  const cx = vw / 2 + Math.cos(angle) * 120;
  const cy = vh / 2 - 40 + Math.sin(angle) * 120;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${target.label} ${Math.round(dist)}m`, cx, cy + 26);
}

function drawMinimap(ctx, state, vw) {
  const size = 168;
  const x0 = vw - size - 16;
  const y0 = 16;
  const sx = size / WORLD.width;
  const sy = size / WORLD.height;
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#5d8a45';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x0, y0 + WORLD.beachY * sy, size, size - WORLD.beachY * sy);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0, y0 + WORLD.waterY * sy, size, size - WORLD.waterY * sy);
  ctx.fillStyle = '#3d3a38';
  for (const rx of roadXs()) ctx.fillRect(x0 + rx * sx - 2, y0, 4, size);
  for (const ry of roadYs()) ctx.fillRect(x0, y0 + ry * sy, size, 4);
  ctx.fillStyle = '#37d67a';
  ctx.fillRect(x0 + PLACES.garage.x * sx - 3, y0 + PLACES.garage.y * sy - 3, 6, 6);
  ctx.fillStyle = '#37b6d6';
  ctx.fillRect(x0 + PLACES.docks.x * sx - 3, y0 + PLACES.docks.y * sy - 3, 6, 6);
  const target = missionTarget(state.world, state.missions, state.player);
  if (target && !state.missions.done) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of state.world.cops) {
    ctx.fillStyle = '#4da3ff';
    ctx.beginPath();
    ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, state, vw, vh) {
  const p = state.player;
  const mission = currentMission(state.missions);
  ctx.textAlign = 'left';
  // Top-left: cash, health, wanted.
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  roundRect(ctx, 12, 12, 250, 96, 10);
  ctx.fill();
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('RICO VEGA', 26, 64);
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 72, 180, 10);
  ctx.fillStyle = p.hp > 50 ? '#37d67a' : p.hp > 25 ? '#ffb13a' : '#ff5a5a';
  ctx.fillRect(26, 72, 180 * (p.hp / 100), 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(stars, 26, 102);
  if (p.bustTimer > 0.2) {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('BUSTED IN ' + (2.5 - p.bustTimer).toFixed(1) + 's — MOVE!', 26, 124);
  }
  // Mission panel, bottom-left.
  if (mission) {
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    roundRect(ctx, 12, vh - 96, 430, 84, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`JOB ${mission.id}/5 — ${mission.title}`, 26, vh - 68);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(mission.brief, 26, vh - 46);
    ctx.fillStyle = '#9fe8ff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(missionProgress(state.missions), 26, vh - 24);
  }
  // Speed + controls hint, bottom-right.
  const speed = p.inCar ? Math.abs(Math.round(p.inCar.speed * 0.36)) : 0;
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  roundRect(ctx, vw - 212, vh - 96, 200, 84, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(p.inCar ? `${speed} km/h` : 'ON FOOT', vw - 26, vh - 60);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#cfd8e3';
  ctx.fillText(p.inCar ? 'SPACE handbrake · E exit car' : 'E steal car · SPACE shoot', vw - 26, vh - 38);
  ctx.fillText('WASD drive/move · SHIFT run · P pause', vw - 26, vh - 22);
  ctx.textAlign = 'left';
  // Toast after a job completes.
  if (state.missions.toast && state.world.time - state.missions.toastAt < 3) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.missions.toast, vw / 2, 120);
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, state, vw);
}

function panel(ctx, vw, vh, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  ctx.fillRect(0, 0, vw, vh);
  const w = 620;
  const h = 120 + lines.length * 30;
  const x = (vw - w) / 2;
  const y = (vh - h) / 2;
  ctx.fillStyle = 'rgba(16,24,36,0.96)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(title, vw / 2, y + 58);
  ctx.fillStyle = '#e8eef5';
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, vw / 2, y + 100 + i * 30));
  ctx.textAlign = 'left';
}

export function drawGame(ctx, state, vw, vh) {
  const cam = state.camera;
  if (state.screen === SCREEN_TITLE) {
    drawWorld(ctx, state, cam, vw, vh);
    panel(ctx, vw, vh, 'BAHIA VERDE HEAT', [
      'A wheelman story in the sun-soaked city of Bahia Verde.',
      'Steal cars, outrun the Bahia PD, and finish 5 jobs for Marisol.',
      '',
      'WASD / arrows — drive & move · SHIFT — run · E — steal / enter car',
      'SPACE — shoot on foot / handbrake in car · P — pause · M — mute',
      '',
      state.hasSave ? 'ENTER — Continue your saved run · R — New game' : 'ENTER — Start the story',
    ], '#ffd23e');
    return;
  }
  if (state.screen === SCREEN_PAUSE) {
    drawWorld(ctx, state, cam, vw, vh);
    drawHud(ctx, state, vw, vh);
    panel(ctx, vw, vh, 'PAUSED', [
      'Take a breath, wheelman. The city waits.',
      '',
      'P or ENTER — resume · R — restart the story',
    ], '#9fe8ff');
    return;
  }
  if (state.screen === SCREEN_OVER) {
    drawWorld(ctx, state, cam, vw, vh);
    const title = state.player.busted ? 'BUSTED' : 'WASTED';
    panel(ctx, vw, vh, title, [
      state.player.busted
        ? 'The Bahia PD finally boxed you in. Marisol will post bail — maybe.'
        : 'Rico went down in the streets of Bahia Verde.',
      `Jobs finished: ${state.missions.index} / 5 · Cash kept: $${state.player.cash}`,
      '',
      'R or ENTER — try again',
    ], '#ff5a5a');
    return;
  }
  if (state.screen === SCREEN_WIN) {
    drawWorld(ctx, state, cam, vw, vh);
    panel(ctx, vw, vh, 'BAHIA VERDE IS YOURS', [
      'All 5 jobs done. The docks, the garage, the whole coast — Rico made it.',
      `Final cash: $${state.player.cash.toLocaleString('en-US')} · Time: ${Math.round(state.world.time)}s`,
      '',
      'R or ENTER — play again',
    ], '#37d67a');
    return;
  }
  drawWorld(ctx, state, cam, vw, vh);
  drawHud(ctx, state, vw, vh);
}
