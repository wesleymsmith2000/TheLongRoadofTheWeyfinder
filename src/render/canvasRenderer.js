import { CELL_SIZE, VOXELS, Roles } from '../core/voxelMask.js';
import { localToWorld } from '../core/math.js';
import { drawDebugOverlay } from '../debug/debugOverlay.js';

const COLORS = {
  core: '#e4d66b',
  armor: '#8fa6ad',
  gun: '#d46e4f',
  wheel: '#5fa66f',
  engine: '#b879d3',
  shadow: 'rgb(0 0 0 / 0.28)',
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
    drawEnemy(ctx, game.enemy, game.time);
    drawProjectiles(ctx, game.enemyProjectiles, '#ffb25f');
    drawProjectiles(ctx, game.playerProjectiles, '#9be5ff');
    drawVehicle(ctx, game.vehicle);
    for (const piece of game.vehicle.detachedPieces) drawDetachedPiece(ctx, piece);
    ctx.restore();
    if (debug.visible) drawDebugOverlay(ctx, game);
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

function drawVehicle(ctx, vehicle) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.heading);
  drawVehicleEdges(ctx, vehicle);
  const attached = vehicle.cells.filter((cell) => cell.attached && !cell.state.destroyed);
  for (const cell of attached) drawCell(ctx, cell, cell.gridX * CELL_SIZE, cell.gridY * CELL_SIZE, 1);
  drawComMarker(ctx, vehicle.centerOfMass);
  ctx.restore();
}

function drawDetachedPiece(ctx, piece) {
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.heading);
  drawCell(ctx, piece.cell, 0, 0, Math.max(0.18, piece.life / 8));
  ctx.restore();
}

function drawCell(ctx, cell, x, y, alpha) {
  const unit = CELL_SIZE / VOXELS;
  const base = COLORS[cell.type] ?? '#bcc2b1';
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x - CELL_SIZE / 2 + 5, y - CELL_SIZE / 2 + 8, CELL_SIZE, CELL_SIZE);
  for (let vy = VOXELS - 1; vy >= 0; vy -= 1) {
    for (let vx = 0; vx < VOXELS; vx += 1) {
      const voxel = cell.mask[vy][vx];
      if (voxel.hp <= 0) continue;
      const fraction = voxel.hp / voxel.maxHp;
      const px = x - CELL_SIZE / 2 + vx * unit;
      const py = y - CELL_SIZE / 2 + vy * unit;
      const lift = 4 + fraction * 5;
      ctx.fillStyle = shade(base, ROLE_SHADE[voxel.role] ?? 0);
      ctx.fillRect(px + 1, py + 1 - lift, unit - 2, unit - 2);
      ctx.fillStyle = shade(base, -36);
      ctx.fillRect(px + 1, py + unit - 3 - lift, unit - 2, 4);
      ctx.fillStyle = 'rgb(255 255 255 / 0.12)';
      ctx.fillRect(px + 2, py + 2 - lift, unit - 4, 2);
    }
  }
  ctx.strokeStyle = cell.type === 'core' ? '#fff4a8' : 'rgb(255 255 255 / 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2 - 4, CELL_SIZE, CELL_SIZE);
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
  ctx.rotate(time * 0.6);
  ctx.fillStyle = '#513f46';
  ctx.strokeStyle = '#f1a267';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawProjectiles(ctx, projectiles, color) {
  ctx.fillStyle = color;
  for (const projectile of projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }
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
