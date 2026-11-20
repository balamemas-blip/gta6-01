// Solmar Heat — all drawing: the city, the cars, the people, and the
// HUD (cash, health, wanted stars, mission panel, minimap, objective
// arrow, boss messages, bust warning). Canvas 2D, no assets.

import { CONFIG, PALETTE, CITY_NAMES } from './config.js';
import { JOBS, currentObjective, missionMarkers } from './missions.js';
import { bustProgress } from './police.js';

export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(cam, target, dt) {
  const k = 1 - Math.exp(-CONFIG.camera.lerp * dt);
  cam.x += (target.x - CONFIG.canvas.width / 2 - cam.x) * k;
  cam.y += (target.y - CONFIG.canvas.height / 2 - cam.y) * k;
  cam.x = Math.max(0, Math.min(CONFIG.world.width - CONFIG.canvas.width, cam.x));
  cam.y = Math.max(0, Math.min(CONFIG.world.height - CONFIG.canvas.height, cam.y));
}

function drawCar(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-24, -10, 48, 24);
  ctx.fillStyle = car.isCop ? '#1d4ed8' : car.color;
  ctx.fillRect(-23, -11, 46, 22);
  ctx.fillStyle = '#bfe3ff';
  ctx.fillRect(-6, -10, 12, 20); // windshield band
  ctx.fillStyle = '#222';
  ctx.fillRect(10, -11, 6, 5);
  ctx.fillRect(10, 6, 6, 5);
  ctx.fillRect(-16, -11, 6, 5);
  ctx.fillRect(-16, 6, 6, 5);
  if (car.isCop) {
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(-2, -11, 5, 6);
    ctx.fillStyle = '#2d7dff';
    ctx.fillRect(-2, 5, 5, 6);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-25, -13, 50, 26);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 6, Math.sin(angle) * 6, 4, 0, Math.PI * 2);
  ctx.fill();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -18);
  }
  ctx.restore();
}

function drawWorld(ctx, world, cam) {
  const W = CONFIG.world;
  // Ground: grass, then the beach and sea at the south edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, W.width, W.height);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(world.beach.x, world.beach.y, world.beach.w, world.beach.h);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(world.sea.x, world.sea.y, world.sea.w, world.sea.h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = 40; x < W.width; x += 160) {
    ctx.fillRect(x, world.sea.y + 8, 60, 3);
  }

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of world.roadXs) ctx.fillRect(rx - W.road / 2, 0, W.road, W.height - W.beachHeight);
  for (const ry of world.roadYs) ctx.fillRect(0, ry - W.road / 2, W.width, W.road);
  // Dashed centre lines.
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of world.roadXs) {
    for (let y = 10; y < W.height - W.beachHeight; y += 46) ctx.fillRect(rx - 2, y, 4, 22);
  }
  for (const ry of world.roadYs) {
    for (let x = 10; x < W.width; x += 46) ctx.fillRect(x, ry - 2, 22, 4);
  }

  // Park.
  for (const p of world.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#3f8f5f';
    for (let i = 0; i < 6; i++) {
      const tx = p.x + 24 + ((i * 53) % (p.w - 48));
      const ty = p.y + 24 + ((i * 37) % (p.h - 48));
      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Buildings with roof colour and a shaded edge.
  for (const b of world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
  }

  // Landmark labels.
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const lm of [world.garage, world.bank, world.docks, world.safehouse]) {
    ctx.fillStyle = 'rgba(16,24,32,0.75)';
    const w = ctx.measureText(lm.label).width + 16;
    ctx.fillRect(lm.x - w / 2, lm.y - 52, w, 22);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(lm.label, lm.x, lm.y - 36);
  }
  void cam;
}

function drawMarkers(ctx, markers, time) {
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  for (const mk of markers) {
    ctx.save();
    ctx.translate(mk.x, mk.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = mk.kind === 'rival' ? '#ff2d2d' : '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = mk.kind === 'rival' ? '#ff2d2d' : '#ffd23f';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mk.label, 0, 1);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
}

function drawMinimap(ctx, world, player, markers, cops, cars) {
  const M = CONFIG.minimap;
  const sx = CONFIG.canvas.width - M.size - M.margin;
  const sy = M.margin;
  const kx = M.size / CONFIG.world.width;
  const ky = M.size / CONFIG.world.height;
  ctx.save();
  ctx.fillStyle = 'rgba(16,24,32,0.85)';
  ctx.fillRect(sx - 4, sy - 4, M.size + 8, M.size + 8);
  ctx.fillStyle = '#2e6b4f';
  ctx.fillRect(sx, sy, M.size, M.size);
  ctx.fillStyle = '#3a3f4a';
  for (const rx of world.roadXs) ctx.fillRect(sx + rx * kx - 2, sy, 4, M.size);
  for (const ry of world.roadYs) ctx.fillRect(sx, sy + ry * ky, M.size, 4);
  for (const mk of markers) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(sx + mk.x * kx, sy + mk.y * ky, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of cars) {
    if (c.occupied) continue;
    ctx.fillStyle = '#ddd';
    ctx.fillRect(sx + c.x * kx - 1, sy + c.y * ky - 1, 2, 2);
  }
  for (const cop of cops) {
    ctx.fillStyle = '#2d7dff';
    ctx.beginPath();
    ctx.arc(sx + cop.x * kx, sy + cop.y * ky, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(sx + player.x * kx, sy + player.y * ky);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawHud(ctx, game) {
  const { player, wanted, missions, police, time } = game;
  ctx.save();
  // Top-left: cash, health, wanted stars.
  ctx.fillStyle = 'rgba(16,24,32,0.8)';
  ctx.fillRect(12, 12, 250, 86);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 24, 40);
  ctx.fillStyle = '#ff5b5b';
  ctx.fillRect(24, 50, 150, 12);
  ctx.fillStyle = '#57e389';
  ctx.fillRect(24, 50, Math.max(0, (150 * player.hp) / CONFIG.player.hp), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, 180, 61);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = wanted > 0 ? '#ffd23f' : '#666';
  ctx.fillText('★'.repeat(wanted) + '☆'.repeat(Math.max(0, 5 - wanted)), 24, 88);

  // Mission panel, top centre.
  const job = JOBS[missions.jobIndex];
  ctx.fillStyle = 'rgba(16,24,32,0.8)';
  ctx.fillRect(300, 12, 680, 62);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(job ? `JOB ${missions.jobIndex + 1}/5 — ${job.name}` : 'ALL JOBS DONE', 316, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(currentObjective(missions, player), 316, 56);

  // Boss message, bottom centre.
  if (missions.message && time - (missions.messageAt || 0) < 9) {
    ctx.fillStyle = 'rgba(16,24,32,0.85)';
    const w = Math.min(720, ctx.measureText(missions.message).width + 28);
    ctx.fillRect((CONFIG.canvas.width - w) / 2, CONFIG.canvas.height - 64, w, 34);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(missions.message, CONFIG.canvas.width / 2, CONFIG.canvas.height - 42);
    ctx.textAlign = 'left';
  }

  // Bust warning.
  const bp = bustProgress(police);
  if (bp > 0) {
    ctx.fillStyle = 'rgba(255,45,45,0.9)';
    ctx.fillRect(CONFIG.canvas.width / 2 - 130, 92, 260, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED IN ' + (CONFIG.cop.bustHoldSec * (1 - bp)).toFixed(1) + 's — DRIVE!', CONFIG.canvas.width / 2, 113);
    ctx.textAlign = 'left';
  }

  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(16,24,32,0.65)';
  ctx.fillRect(12, CONFIG.canvas.height - 34, 560, 22);
  ctx.fillStyle = '#cfd8dc';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD drive / walk · Shift run · E steal car · Space shoot / handbrake · P pause · M mute · R restart', 20, CONFIG.canvas.height - 19);
  ctx.restore();
}

function drawObjectiveArrow(ctx, player, markers) {
  if (!markers.length) return;
  const mk = markers[0];
  const dx = mk.x - player.x;
  const dy = mk.y - player.y;
  if (Math.hypot(dx, dy) < 130) return;
  const ang = Math.atan2(dy, dx);
  const cx = CONFIG.canvas.width / 2 + Math.cos(ang) * 150;
  const cy = CONFIG.canvas.height / 2 + Math.sin(ang) * 110;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function render(ctx, game) {
  const { world, player, cars, peds, police, missions, time, cam } = game;
  ctx.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, world, cam);
  const markers = missionMarkers(missions, world, player, cars);
  drawMarkers(ctx, markers, time);
  for (const car of cars) drawCar(ctx, car, car === player.inCar);
  for (const cop of police.cops) drawCar(ctx, { ...cop, color: '#1d4ed8', isCop: true }, false);
  for (const ped of peds) drawPerson(ctx, ped.x, ped.y, ped.angle, `hsl(${ped.hue},60%,55%)`);
  if (missions.jobIndex === 2 && missions.step === 0) {
    drawPerson(ctx, missions.milo.x, missions.milo.y, 0, '#ffd23f', 'Milo');
  }
  for (const r of missions.rivals) {
    if (r.hp > 0) drawPerson(ctx, r.x, r.y, Math.atan2(player.y - r.y, player.x - r.x), '#c0392b', '!');
  }
  if (!player.inCar) drawPerson(ctx, player.x, player.y, player.angle, '#2f80ed');
  ctx.restore();

  drawObjectiveArrow(ctx, player, markers);
  drawHud(ctx, game);
  drawMinimap(ctx, world, player, markers, police.cops, cars);
}

export function drawTitle(ctx, game, saved) {
  const W = CONFIG.canvas.width;
  const H = CONFIG.canvas.height;
  ctx.fillStyle = '#0e1a24';
  ctx.fillRect(0, 0, W, H);
  // Sun-soaked skyline silhouette.
  ctx.fillStyle = '#ff9e4f';
  ctx.beginPath();
  ctx.arc(W - 220, 130, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  for (let i = 0; i < 14; i++) {
    const bw = 60 + ((i * 37) % 50);
    const bh = 120 + ((i * 53) % 180);
    ctx.fillRect(30 + i * 88, H - 180 - bh, bw, bh);
  }
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(0, H - 180, W, 180);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 74px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', W / 2, 150);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime story in the sun-soaked city of Solmar', W / 2, 195);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('Five jobs for Rosa Delgado. Steal cars, outrun the Solmar PD, and take the Big Score.', W / 2, 228);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to start', W / 2, 300);
  if (saved) ctx.fillText('Press C to continue your saved game', W / 2, 334);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#cfd8dc';
  ctx.fillText('WASD / arrows — drive & walk · Shift — run · E — steal / exit car · Space — shoot / handbrake', W / 2, 400);
  ctx.fillText('P — pause · M — mute · R — restart · Your progress saves automatically', W / 2, 426);
  ctx.textAlign = 'left';
  void game;
}

export function drawEnd(ctx, title, lines, accent) {
  const W = CONFIG.canvas.width;
  const H = CONFIG.canvas.height;
  ctx.fillStyle = 'rgba(10,16,22,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, 240);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 300 + i * 34));
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfd8dc';
  ctx.fillText('Press ENTER to play again · R to restart', W / 2, 300 + lines.length * 34 + 30);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(10,16,22,0.7)';
  ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CONFIG.canvas.width / 2, CONFIG.canvas.height / 2);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P to keep playing', CONFIG.canvas.width / 2, CONFIG.canvas.height / 2 + 40);
  ctx.textAlign = 'left';
}
