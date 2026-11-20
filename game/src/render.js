// Solmar Heat — render: every pixel the player sees. Top-down camera that
// follows the player, the city drawn from the world data, the HUD (cash,
// health, wanted stars, mission), a live minimap, and the title / pause /
// win / busted screens. All art is drawn in code — no image assets.

import { WORLD, COLORS, STORY, MISSIONS } from './config.js';
import { clamp, dist } from './random.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function drawCar(ctx, x, y, angle, color, isPolice) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-19, -9, 38, 22);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-18, -10, 36, 20, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-4, -9, 12, 18); // windshield + roof
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(16, -8, 2, 4);
  ctx.fillRect(16, 4, 2, 4); // headlights
  if (isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, -10, 10, 20);
    ctx.fillStyle = '#20304a';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', -9, 3);
  }
  ctx.restore();
}

function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = Math.sin(p.walkPhase) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, bob * 0.4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2 - 5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, state) {
  const { cam, city } = state;
  const x0 = cam.x - VIEW_W / 2;
  const y0 = cam.y - VIEW_H / 2;
  const x1 = cam.x + VIEW_W / 2;
  const y1 = cam.y + VIEW_H / 2;

  // Ground.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0, y0, VIEW_W, VIEW_H);
  // Mown stripes for texture.
  ctx.fillStyle = COLORS.grassDark;
  for (let gy = 0; gy < WORLD.h; gy += 160) {
    if (gy + 80 > y0 && gy < y1) ctx.fillRect(x0, gy, VIEW_W, 80);
  }
  // Beach + water along the south edge.
  ctx.fillStyle = COLORS.beach;
  ctx.fillRect(x0, WORLD.beachY, VIEW_W, 46);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0, WORLD.beachY + 46, VIEW_W, WORLD.h - WORLD.beachY - 46);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let wx = 0; wx < WORLD.w; wx += 130) {
    ctx.fillRect(wx + ((state.time * 12) % 130), WORLD.beachY + 60, 46, 3);
  }
  // Parks.
  for (const park of city.parks) {
    if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#2f6b2f';
    for (let tx = park.x + 24; tx < park.x + park.w - 12; tx += 52) {
      for (let ty = park.y + 24; ty < park.y + park.h - 12; ty += 52) {
        ctx.beginPath();
        ctx.arc(tx, ty, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Roads.
  ctx.fillStyle = COLORS.road;
  for (const rx of WORLD.roadsX) ctx.fillRect(rx - WORLD.roadHalf, 0, WORLD.roadHalf * 2, WORLD.beachY);
  for (const ry of WORLD.roadsY) ctx.fillRect(0, ry - WORLD.roadHalf, WORLD.w, WORLD.roadHalf * 2);
  // Sidewalks.
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of WORLD.roadsX) {
    ctx.fillRect(rx - WORLD.roadHalf - 8, 0, 8, WORLD.beachY);
    ctx.fillRect(rx + WORLD.roadHalf, 0, 8, WORLD.beachY);
  }
  for (const ry of WORLD.roadsY) {
    ctx.fillRect(0, ry - WORLD.roadHalf - 8, WORLD.w, 8);
    ctx.fillRect(0, ry + WORLD.roadHalf, WORLD.w, 8);
  }
  // Dashed centre lines.
  ctx.fillStyle = COLORS.roadLine;
  for (const rx of WORLD.roadsX) {
    for (let y = 20; y < WORLD.beachY; y += 56) ctx.fillRect(rx - 2, y, 4, 26);
  }
  for (const ry of WORLD.roadsY) {
    for (let x = 20; x < WORLD.w; x += 56) ctx.fillRect(x, ry - 2, 26, 4);
  }
  // Buildings.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = COLORS.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 16, 12);
      }
    }
  }
}

function drawMarker(ctx, state, target) {
  if (!target) return;
  const pulse = 1 + Math.sin(state.time * 5) * 0.12;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = '#37d6ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#37d6ff';
  ctx.beginPath();
  ctx.moveTo(0, -34 * pulse);
  ctx.lineTo(9, -18);
  ctx.lineTo(-9, -18);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeText(target.name, 0, 52);
  ctx.fillText(target.name, 0, 52);
  ctx.restore();
}

function drawMinimap(ctx, state) {
  const mw = 208;
  const mh = 156;
  const mx = VIEW_W - mw - 14;
  const my = 14;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,24,0.82)';
  ctx.beginPath();
  ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.strokeStyle = '#37d6ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#2f7d3a';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#3a3f47';
  for (const rx of WORLD.roadsX) ctx.fillRect(mx + rx * sx - 1, my, 2, mh);
  for (const ry of WORLD.roadsY) ctx.fillRect(mx, my + ry * sy, mw, 2);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx, my + WORLD.beachY * sy, mw, mh - WORLD.beachY * sy);
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const c of state.police) dot(c.x, c.y, '#ff4d4d', 3.5);
  const target = state.missionTarget;
  if (target) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.2;
    dot(target.x, target.y, '#37d6ff', pulse);
  }
  dot(state.player.x, state.player.y, '#ffd23f', 4);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, state) {
  const p = state.player;
  // Top-left: cash, health, wanted.
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 300, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 26, 42);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 52, 150, 12);
  ctx.fillStyle = p.health > 40 ? '#4dd35a' : '#e33e2b';
  ctx.fillRect(26, 52, 150 * clamp(p.health, 0, 100) / 100, 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`HP ${Math.max(0, Math.ceil(p.health))}`, 184, 63);
  // Wanted stars.
  ctx.font = '22px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(stars, 26, 92);
  ctx.restore();

  // Mission panel, top-centre.
  const mission = MISSIONS[state.missions.index];
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  const mw = 460;
  ctx.beginPath();
  ctx.roundRect((VIEW_W - mw) / 2, 12, mw, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#37d6ff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mission ? mission.title : 'Free roam', VIEW_W / 2, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(state.objective, VIEW_W / 2, 56);
  ctx.restore();

  // Speed + context hint, bottom-left.
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(12, VIEW_H - 58, 250, 46, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  const speed = p.inCar ? Math.abs(Math.round(p.inCar.speed * 0.22)) : 0;
  ctx.fillText(p.inCar ? `${speed} km/h` : 'On foot', 26, VIEW_H - 30);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#bcd';
  ctx.fillText(p.inCar ? 'E exit · SPACE handbrake' : 'E enter car · SPACE shoot', 110, VIEW_H - 30);
  ctx.restore();

  // Banner toast.
  if (state.missions.bannerTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.missions.bannerTimer);
    ctx.fillStyle = 'rgba(8,14,24,0.8)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W / 2 - 260, 92, 520, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.missions.banner, VIEW_W / 2, 114);
    ctx.restore();
  }

  // Off-screen objective arrow at the screen edge.
  const target = state.missionTarget;
  if (target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 420) {
      const ang = Math.atan2(dy, dx);
      const ax = VIEW_W / 2 + Math.cos(ang) * 300;
      const ay = VIEW_H / 2 + Math.sin(ang) * 210;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#37d6ff';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(d / 10) * 10}m`, ax, ay + 28);
      ctx.restore();
    }
  }
  drawMinimap(ctx, state);
}

function drawPlayer(ctx, p) {
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.facing);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(6, -3, 8, 6); // arm / gun direction
  ctx.restore();
}

function panel(ctx, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,18,0.86)';
  ctx.beginPath();
  ctx.roundRect(240, 70, 800, 600, 16);
  ctx.fill();
  ctx.strokeStyle = accent || '#37d6ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#37d6ff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, VIEW_W / 2, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  // Word-wrap: canvas fillText never wraps, so split long lines to the
  // panel's inner width instead of letting them run off the edges.
  const wrapped = [];
  for (const line of lines) {
    if (line === '') { wrapped.push(''); continue; }
    const words = line.split(' ');
    let cur = '';
    for (const word of words) {
      const trial = cur === '' ? word : cur + ' ' + word;
      if (ctx.measureText(trial).width > 740 && cur !== '') {
        wrapped.push(cur);
        cur = word;
      } else {
        cur = trial;
      }
    }
    if (cur !== '' || line === '') wrapped.push(cur);
  }
  let y = 198;
  for (const line of wrapped) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 24;
  }
  ctx.restore();
  return y;
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.screen === 'title') {
    // City backdrop behind the title: draw the world from a fixed camera.
    ctx.save();
    ctx.translate(VIEW_W / 2 - state.cam.x, VIEW_H / 2 - state.cam.y);
    drawWorld(ctx, state);
    for (const c of state.traffic) drawCar(ctx, c.x, c.y, c.angle, c.color, false);
    for (const c of state.parked) drawCar(ctx, c.x, c.y, c.angle, c.color, false);
    ctx.restore();
    ctx.fillStyle = 'rgba(6,10,18,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const y = panel(ctx, STORY.title, [
      STORY.tagline,
      '',
      STORY.intro,
      '',
      ...STORY.controls,
      '',
      STORY.tips,
      '',
      state.hasSave ? 'ENTER — Start new game      C — Continue (Job ' + (state.saveMission + 1) + ')' : 'ENTER — Start game',
      state.hasSave ? '' : '',
    ], '#ffd23f');
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A complete open world: drive, steal, run from the police, finish all 5 jobs.', VIEW_W / 2, y + 8);
    return;
  }

  ctx.save();
  ctx.translate(VIEW_W / 2 - state.cam.x, VIEW_H / 2 - state.cam.y);
  drawWorld(ctx, state);
  for (const m of state.collectMarkers) {
    ctx.save();
    ctx.translate(m.place.x, m.place.y);
    ctx.fillStyle = '#7dff8a';
    ctx.beginPath();
    ctx.arc(0, 0, 12 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12350f';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 5);
    ctx.restore();
  }
  drawMarker(ctx, state, state.missionTarget);
  for (const c of state.parked) drawCar(ctx, c.x, c.y, c.angle, c.color, false);
  for (const c of state.traffic) drawCar(ctx, c.x, c.y, c.angle, c.color, false);
  for (const c of state.police) {
    drawCar(ctx, c.x, c.y, c.angle, c.color, true);
    const flash = Math.floor(state.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4d4d' : '#4d7dff';
    ctx.beginPath();
    ctx.arc(c.x - 8, c.y - 12, 4, 0, Math.PI * 2);
    ctx.arc(c.x + 8, c.y - 12, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ped of state.peds) drawPed(ctx, ped);
  if (state.player.inCar) {
    const car = state.player.inCar;
    drawCar(ctx, car.x, car.y, car.angle, COLORS.playerCar, false);
  }
  drawPlayer(ctx, state.player);
  for (const b of state.bullets) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Busted progress ring over the player while a cop holds them.
  if (state.bustedProgress > 0) {
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, 26, -Math.PI / 2, -Math.PI / 2 + state.bustedProgress * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', state.player.x, state.player.y - 34);
  }
  ctx.restore();

  drawHud(ctx, state);

  if (state.screen === 'paused') {
    ctx.fillStyle = 'rgba(6,10,18,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(ctx, 'PAUSED', ['Press P or ENTER to keep playing.', 'M — mute sound. Progress saves after every job.'], '#ffd23f');
  }
  if (state.screen === 'win') {
    ctx.fillStyle = 'rgba(6,10,18,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(ctx, 'SOLMAR LEGEND', [
      'All five jobs done. The city is yours, Dario.',
      '',
      `Total cash: $${state.player.cash}    Time: ${formatTime(state.playTime)}`,
      `Jobs finished: 5 / 5    Wanted at the end: ${state.wanted} stars`,
      '',
      'Press R to play again, or ENTER for a new game.',
    ], '#7dff8a');
  }
  if (state.screen === 'lose') {
    ctx.fillStyle = 'rgba(20,4,6,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(ctx, state.loseReason === 'busted' ? 'BUSTED' : 'WASTED', [
      state.loseReason === 'busted'
        ? 'The Solmar police finally held you long enough to cuff you.'
        : 'You ran out of health on the streets of Solmar.',
      '',
      `You reached Job ${state.missions.index + 1} of 5 with $${state.player.cash}.`,
      'Your saved progress keeps the jobs you already finished.',
      '',
      'Press R to retry this job, or ENTER for a new game.',
    ], '#ff4d4d');
  }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export { VIEW_W, VIEW_H };
