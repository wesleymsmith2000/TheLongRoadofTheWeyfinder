import { CELL_SIZE, VOXELS, Roles } from '../core/voxelMask.js';
import { drawDebugOverlay } from '../debug/debugOverlay.js';

const COLORS = {
  core: '#e4d66b',
  armor: '#8fa6ad',
  gun: '#d46e4f',
  wheel: '#5fa66f',
  engine: '#b879d3',
  shadow: 'rgb(0 0 0 / 0.28)',
};

const BOSS_COLORS = {
  core: '#8b0000',
  armor: '#08080a',
  gun: '#ff7a1a',
  wheel: '#5fa66f',
  engine: '#b879d3',
  shadow: 'rgb(0 0 0 / 0.34)',
};

const ROLE_SHADE = {
  [Roles.STRUCTURE]: 0,
  [Roles.ARMOR]: 24,
  [Roles.ANCHOR]: -18,
  [Roles.WIRE]: 42,
  [Roles.DEVICE]: 64,
};

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(window.innerWidth * ratio);
    this.canvas.height = Math.floor(window.innerHeight * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  draw(game, debug) {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#171a1b';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    applyCameraTransform(ctx, game.camera, w, h);
    drawRoad(ctx, game.camera, w, h, game.time);
    drawRoadLane(ctx, game.road);
    drawIncomingMarkers(ctx, game.incomingMarkers, game.time);
    drawScrapPickups(ctx, game.scrapPickups);
    for (const enemy of game.enemies) drawEnemy(ctx, enemy, game.time);
    drawSmokeParticles(ctx, game.smokeParticles);
    drawProjectiles(ctx, game.enemyProjectiles, '#ffb25f');
    drawProjectiles(ctx, game.playerProjectiles, '#9be5ff');
    drawVehicle(ctx, game.vehicle, game.boost, game.time);
    drawAimReticle(ctx, game.aimReticle);
    for (const piece of game.vehicle.detachedPieces) drawDetachedPiece(ctx, piece);
    ctx.restore();
    if (debug.visible) drawDebugOverlay(ctx, game);
  }
}

function drawIncomingMarkers(ctx, markers = [], time = 0) {
  for (const marker of markers) {
    const flash = Math.sin(time * 18) * 0.5 + 0.5;
    const size = marker.type === 'boss' ? 22 : marker.type === 'enhanced' ? 17 : 13;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.globalAlpha = 0.32 + flash * 0.68;
    ctx.strokeStyle = marker.type === 'boss' ? '#ff462e' : marker.type === 'enhanced' ? '#f7c06a' : '#83f7ff';
    ctx.fillStyle = marker.type === 'boss' ? 'rgb(139 0 0 / 0.24)' : 'rgb(247 192 106 / 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.86, size * 0.5);
    ctx.lineTo(-size * 0.86, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.45);
    ctx.lineTo(0, size * 0.25);
    ctx.moveTo(-size * 0.35, size * 0.25);
    ctx.lineTo(size * 0.35, size * 0.25);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAimReticle(ctx, reticle) {
  if (!reticle?.active) return;
  ctx.save();
  ctx.translate(reticle.x, reticle.y);
  ctx.strokeStyle = reticle.source === 'gamepad' ? '#f7c06a' : '#83f7ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.moveTo(-16, 0);
  ctx.lineTo(-6, 0);
  ctx.moveTo(6, 0);
  ctx.lineTo(16, 0);
  ctx.moveTo(0, -16);
  ctx.lineTo(0, -6);
  ctx.moveTo(0, 6);
  ctx.lineTo(0, 16);
  ctx.stroke();
  ctx.restore();
}

function drawScrapPickups(ctx, pickups) {
  for (const pickup of pickups) {
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.fillStyle = '#c9b66f';
    ctx.strokeStyle = '#fff1a8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-pickup.radius, -pickup.radius, pickup.radius * 2, pickup.radius * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function applyCameraTransform(ctx, camera, w, h) {
  ctx.translate(w / 2, h * 0.58);
  ctx.rotate(-camera.heading);
  ctx.translate(-camera.x, -camera.y);
}

function drawRoad(ctx, camera, w, h, time) {
  ctx.strokeStyle = '#29302e';
  ctx.lineWidth = 1;
  const spacing = 64;
  const range = Math.max(w, h) * 1.9;
  const minX = Math.floor((camera.x - range) / spacing) * spacing;
  const maxX = Math.ceil((camera.x + range) / spacing) * spacing;
  const minY = Math.floor((camera.y - range) / spacing) * spacing;
  const maxY = Math.ceil((camera.y + range) / spacing) * spacing;
  const offset = (time * 12) % spacing;
  for (let x = minX; x <= maxX; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + offset, minY);
    ctx.lineTo(x + offset - range * 0.18, maxY);
    ctx.stroke();
  }
  for (let y = minY; y <= maxY; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(minX, y + offset);
    ctx.lineTo(maxX, y + offset);
    ctx.stroke();
  }
}

function drawRoadLane(ctx, road) {
  ctx.save();
  ctx.translate(road.x, road.y);
  ctx.rotate(road.heading);
  ctx.strokeStyle = 'rgb(233 242 223 / 0.16)';
  ctx.setLineDash([16, 14]);
  ctx.lineWidth = 2;
  ctx.strokeRect(-road.halfWidth, -road.halfHeight, road.halfWidth * 2, road.halfHeight * 2);
  ctx.restore();
}

function drawVehicle(ctx, vehicle, boost, time) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.heading);
  drawBoostShield(ctx, boost, time);
  drawVehicleEdges(ctx, vehicle);
  const attached = vehicle.cells.filter((cell) => cell.attached && !cell.state.destroyed);
  for (const cell of attached) drawCell(ctx, cell, cell.gridX * CELL_SIZE, cell.gridY * CELL_SIZE, 1);
  drawTurret(ctx, vehicle);
  drawComMarker(ctx, vehicle.centerOfMass);
  ctx.restore();
}

function drawBoostShield(ctx, boost, time) {
  if (!boost || boost.activeTime <= 0) return;
  const t = boost.activeTime / Math.max(boost.maxDuration, 0.001);
  const shimmer = Math.sin(time * 48) * 0.5 + 0.5;
  const radius = CELL_SIZE * (3.2 + shimmer * 0.42);
  ctx.save();
  ctx.rotate(-time * 1.6);
  ctx.globalAlpha = 0.18 + t * 0.28;
  const gradient = ctx.createRadialGradient(0, 0, radius * 0.45, 0, 0, radius);
  gradient.addColorStop(0, 'rgb(131 247 255 / 0.03)');
  gradient.addColorStop(0.72, 'rgb(131 247 255 / 0.18)');
  gradient.addColorStop(1, 'rgb(247 192 106 / 0.28)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgb(131 247 255 / 0.72)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([CELL_SIZE * 0.9, CELL_SIZE * 0.45]);
  ctx.beginPath();
  ctx.arc(0, 0, radius * (0.96 + shimmer * 0.05), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTurret(ctx, vehicle) {
  const gun = vehicle.cells.find((cell) => cell.attached && cell.type === 'gun' && !cell.state.destroyed);
  if (!gun) return;
  ctx.save();
  const localHeading = vehicle.turretHeading - vehicle.heading;
  const baseX = gun.gridX * CELL_SIZE;
  const baseY = gun.gridY * CELL_SIZE;
  const dx = Math.cos(localHeading) * CELL_SIZE * 1.1;
  const dy = Math.sin(localHeading) * CELL_SIZE * 1.1;
  ctx.strokeStyle = '#f7c06a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX + dx, baseY + dy);
  ctx.stroke();
  ctx.restore();
}

function drawDetachedPiece(ctx, piece) {
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.heading);
  drawCell(ctx, piece.cell, 0, 0, Math.max(0.18, piece.life / 8));
  ctx.restore();
}

function drawCell(ctx, cell, x, y, alpha, palette = COLORS) {
  const unit = CELL_SIZE / VOXELS;
  const base = palette[cell.type] ?? COLORS[cell.type] ?? '#bcc2b1';
  const depth = CELL_SIZE * 0.11;
  const shadowOffset = CELL_SIZE * 0.15;
  const gap = Math.max(0.5, unit * 0.11);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = palette.shadow ?? COLORS.shadow;
  ctx.fillRect(x - CELL_SIZE / 2 + shadowOffset, y - CELL_SIZE / 2 + shadowOffset * 1.6, CELL_SIZE, CELL_SIZE);
  for (let vy = VOXELS - 1; vy >= 0; vy -= 1) {
    for (let vx = 0; vx < VOXELS; vx += 1) {
      const voxel = cell.mask[vy][vx];
      if (voxel.hp <= 0) continue;
      const fraction = voxel.hp / voxel.maxHp;
      const px = x - CELL_SIZE / 2 + vx * unit;
      const py = y - CELL_SIZE / 2 + vy * unit;
      const lift = depth + fraction * depth;
      ctx.fillStyle = shade(base, ROLE_SHADE[voxel.role] ?? 0);
      ctx.fillRect(px + gap, py + gap - lift, unit - gap * 2, unit - gap * 2);
      ctx.fillStyle = shade(base, -36);
      ctx.fillRect(px + gap, py + unit - gap * 2 - lift, unit - gap * 2, Math.max(1, depth * 0.65));
      ctx.fillStyle = 'rgb(255 255 255 / 0.12)';
      ctx.fillRect(px + gap * 1.5, py + gap * 1.5 - lift, Math.max(1, unit - gap * 3), Math.max(1, depth * 0.3));
    }
  }
  ctx.strokeStyle = cell.type === 'core' ? '#fff4a8' : 'rgb(255 255 255 / 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2 - depth, CELL_SIZE, CELL_SIZE);
  ctx.restore();
}

function drawVehicleEdges(ctx, vehicle) {
  ctx.strokeStyle = 'rgb(244 238 228 / 0.24)';
  ctx.lineWidth = 2;
  for (const edge of vehicle.connections) {
    if (!edge.valid) continue;
    const a = vehicle.cells.find((cell) => cell.id === edge.a);
    const b = vehicle.cells.find((cell) => cell.id === edge.b);
    if (!a?.attached || !b?.attached) continue;
    ctx.beginPath();
    ctx.moveTo(a.gridX * CELL_SIZE, a.gridY * CELL_SIZE);
    ctx.lineTo(b.gridX * CELL_SIZE, b.gridY * CELL_SIZE);
    ctx.stroke();
  }
}

function drawComMarker(ctx, com) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(com.x - 6, com.y);
  ctx.lineTo(com.x + 6, com.y);
  ctx.moveTo(com.x, com.y - 6);
  ctx.lineTo(com.x, com.y + 6);
  ctx.stroke();
}

function drawEnemy(ctx, enemy, time) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  drawBossLaserTelegraphs(ctx, enemy, time);
  drawBossTentacleWiggle(ctx, enemy, time);
  const palette = enemy.kind === 'boss' ? BOSS_COLORS : enemy.palette ?? COLORS;
  for (const cell of enemy.cells) {
    if (!cell.state.destroyed) {
      const position = bossCellVisualPosition(enemy, cell, time);
      drawCell(ctx, cell, position.x, position.y, enemy.destroyed ? 0.35 : 1, palette);
    }
  }
  if (enemy.destroyed) {
    drawEnemyExplosion(ctx, enemy, time);
  } else {
    ctx.strokeStyle = enemy.kind === 'boss' ? '#ff5a2c' : enemy.kind === 'enhanced' ? palette.gun ?? '#f08a3e' : '#f1a267';
    ctx.lineWidth = 2;
    if (enemy.kind === 'boss') drawBossOutline(ctx, enemy, time);
    else ctx.strokeRect(-CELL_SIZE * 1.7, -CELL_SIZE * 1.7, CELL_SIZE * 3.4, CELL_SIZE * 3.4);
  }
  ctx.restore();
}

function drawBossLaserTelegraphs(ctx, enemy, time) {
  if (enemy.kind !== 'boss') return;
  for (const arm of enemy.arms ?? []) {
    if (!arm.laser?.target) continue;
    const progress = 1 - Math.max(0, arm.laser.timer / Math.max(0.001, arm.laser.duration));
    const flashRate = 8 + progress * 46;
    const flash = Math.sin(time * flashRate) * 0.5 + 0.5;
    const source = arm.laser.source ?? { x: enemy.x, y: enemy.y };
    ctx.save();
    ctx.globalAlpha = 0.2 + flash * 0.65;
    ctx.strokeStyle = '#ff2626';
    ctx.lineWidth = 1 + progress * 2.5;
    ctx.setLineDash(progress > 0.9 ? [] : [CELL_SIZE * 0.7, CELL_SIZE * 0.46]);
    ctx.beginPath();
    ctx.moveTo(source.x - enemy.x, source.y - enemy.y);
    ctx.lineTo(arm.laser.target.x - enemy.x, arm.laser.target.y - enemy.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBossTentacleWiggle(ctx, enemy, time) {
  if (enemy.kind !== 'boss') return;
  const unfurl = easeOutCubic(enemy.armUnfurl ?? 1);
  ctx.save();
  ctx.strokeStyle = 'rgb(255 122 26 / 0.18)';
  ctx.lineWidth = 2;
  for (const arm of enemy.arms ?? []) {
    ctx.beginPath();
    ctx.moveTo(CELL_SIZE * 0.5, CELL_SIZE * 0.5);
    const phase = arm.phase ?? time;
    for (let segment = 1; segment <= 8; segment += 1) {
      const wave = Math.sin(phase * 1.45 + segment * 0.95) * CELL_SIZE * 1.08 * unfurl;
      const x = CELL_SIZE * (0.5 + arm.direction.x * (3 + segment) * unfurl) - arm.direction.y * wave;
      const y = CELL_SIZE * (0.5 + arm.direction.y * (3 + segment) * unfurl) + arm.direction.x * wave + (1 - unfurl) * CELL_SIZE * (2.2 + segment * 0.32);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function bossCellVisualPosition(enemy, cell, time) {
  if (enemy.kind !== 'boss') return { x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE };
  const match = /^arm-(\d+)-(\d+)-/.exec(cell.id);
  if (!match) return { x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE };
  const arm = enemy.arms?.[Number(match[1])];
  if (!arm) return { x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE };
  const segment = Number(match[2]);
  const unfurl = easeOutCubic(enemy.armUnfurl ?? 1);
  const base = { x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE };
  const tucked = {
    x: (arm.index - 3.5) * CELL_SIZE * 0.42 + (cell.type === 'gun' ? CELL_SIZE * 0.18 : 0),
    y: CELL_SIZE * (2.1 + segment * 0.36 + (cell.type === 'gun' ? 0.16 : 0)),
  };
  const wave = Math.sin((arm.phase ?? time) * 1.55 + segment * 0.92) * CELL_SIZE * 1.12 * unfurl;
  const sway = {
    x: -arm.direction.y * wave,
    y: arm.direction.x * wave,
  };
  return {
    x: tucked.x + (base.x - tucked.x) * unfurl + sway.x,
    y: tucked.y + (base.y - tucked.y) * unfurl + sway.y,
  };
}

function easeOutCubic(value) {
  const t = Math.max(0, Math.min(1, value));
  return 1 - (1 - t) ** 3;
}

function drawBossOutline(ctx, enemy, time) {
  const shimmer = Math.sin(time * 5) * 0.5 + 0.5;
  const radius = Math.max(CELL_SIZE * 4, enemy.radius * 0.28);
  ctx.save();
  ctx.strokeStyle = `rgb(${120 + shimmer * 70} 0 0 / 0.8)`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const angle = Math.PI / 8 + (Math.PI * 2 * index) / 8;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawEnemyExplosion(ctx, enemy, time) {
  if (enemy.explosionStart == null) return;
  const age = time - enemy.explosionStart;
  if (age < 0 || age > 0.48) return;
  const t = age / 0.48;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = '#ff7461';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, CELL_SIZE * (1.4 + t * 4.4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#fff1a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, CELL_SIZE * (0.8 + t * 2.3), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawProjectiles(ctx, projectiles, color) {
  for (const projectile of projectiles) {
    if (projectile.behavior === 'beam') {
      drawBeam(ctx, projectile);
      continue;
    }
    if (projectile.behavior === 'blast') {
      drawBlast(ctx, projectile);
      continue;
    }
    if (projectile.weapon === 'boss-missile') {
      drawBossMissile(ctx, projectile);
      continue;
    }
    if (projectile.weapon === 'rocket' && projectile.shape?.kind === 'cylinderCone') {
      drawRocket(ctx, projectile);
      continue;
    }
    ctx.fillStyle =
      projectile.weapon === 'rocket'
        ? '#ff7461'
        : projectile.weapon === 'cannon'
          ? '#fff1a8'
          : projectile.weapon === 'cannon-shrapnel'
            ? '#ffd37a'
            : projectile.weapon === 'beam'
              ? '#83f7ff'
              : projectile.color ?? color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBossMissile(ctx, projectile) {
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(projectile.angle);
  ctx.fillStyle = '#050506';
  ctx.strokeStyle = '#320000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-7, -2.6, 11, 5.2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b51212';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(4, -3.2);
  ctx.lineTo(4, 3.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSmokeParticles(ctx, particles = []) {
  for (const particle of particles) {
    const age = 1 - Math.max(0, particle.lifetime / particle.maxLifetime);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.52 * (1 - age));
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRocket(ctx, projectile) {
  const shape = projectile.shape;
  const bodyLength = shape.bodyLength ?? 12;
  const coneLength = shape.coneLength ?? 5;
  const halfWidth = shape.halfWidth ?? projectile.radius;
  const bodyStart = -bodyLength / 2;
  const bodyEnd = bodyLength / 2;
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(projectile.angle);

  const bodyIntegrity = sectionIntegrity(projectile.hull, 'cylinder');
  const coneIntegrity = sectionIntegrity(projectile.hull, 'cone');
  ctx.fillStyle = shade('#8a8a86', Math.round((bodyIntegrity - 1) * 74));
  ctx.strokeStyle = '#202222';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.rect(bodyStart, -halfWidth, bodyLength, halfWidth * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = shade('#df6f2e', Math.round((coneIntegrity - 1) * 74));
  ctx.beginPath();
  ctx.moveTo(bodyEnd + coneLength, 0);
  ctx.lineTo(bodyEnd, -halfWidth);
  ctx.lineTo(bodyEnd, halfWidth);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgb(255 241 168 / 0.75)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(bodyStart + 1, -halfWidth * 0.45);
  ctx.lineTo(bodyEnd - 1, -halfWidth * 0.45);
  ctx.stroke();

  drawRocketHullVoxels(ctx, projectile.hull);
  ctx.restore();
}

function drawRocketHullVoxels(ctx, hull) {
  if (!hull) return;
  for (const section of hull.sections) {
    for (const voxel of section.voxels) {
      if (voxel.hp <= 0) continue;
      const fraction = voxel.hp / voxel.maxHp;
      ctx.globalAlpha = 0.2 + fraction * 0.38;
      ctx.fillStyle = '#f4fffb';
      ctx.fillRect(voxel.x - 0.45, voxel.y - 0.45, 0.9, 0.9);
      ctx.globalAlpha = 1;
    }
  }
}

function sectionIntegrity(hull, id) {
  const section = hull?.sections.find((candidate) => candidate.id === id);
  if (!section) return 1;
  const total = section.voxels.reduce((sum, voxel) => sum + voxel.maxHp, 0);
  const remaining = section.voxels.reduce((sum, voxel) => sum + voxel.hp, 0);
  return total <= 0 ? 1 : remaining / total;
}

function drawBlast(ctx, projectile) {
  const age = 1 - Math.max(0, projectile.lifetime / projectile.maxLifetime);
  const radius = projectile.radius + (projectile.maxRadius - projectile.radius) * age;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - age);
  ctx.strokeStyle = '#fff1a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ff8f61';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, radius * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBeam(ctx, projectile) {
  const age = 1 - Math.max(0, projectile.lifetime / projectile.maxLifetime);
  const widthEnvelope = Math.sin(age * Math.PI);
  const baseVoxelWidth = projectile.radius ?? 1;
  const voxelWidth = baseVoxelWidth + widthEnvelope * baseVoxelWidth * 4;
  const endX = projectile.renderEndX ?? projectile.x + Math.cos(projectile.angle) * projectile.length;
  const endY = projectile.renderEndY ?? projectile.y + Math.sin(projectile.angle) * projectile.length;
  ctx.save();
  ctx.globalAlpha = 0.35 + widthEnvelope * 0.65;
  ctx.strokeStyle = projectile.color ?? '#83f7ff';
  ctx.lineWidth = (CELL_SIZE / VOXELS) * voxelWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(projectile.x, projectile.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.strokeStyle = '#f4fffb';
  ctx.lineWidth = Math.max(1, (CELL_SIZE / VOXELS) * Math.min(1.5, voxelWidth * 0.35));
  ctx.stroke();
  ctx.restore();
}

function shade(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = clampColor((n >> 16) + amount);
  const g = clampColor(((n >> 8) & 255) + amount);
  const b = clampColor((n & 255) + amount);
  return `rgb(${r} ${g} ${b})`;
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}
