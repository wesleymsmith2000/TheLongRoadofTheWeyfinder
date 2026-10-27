import { CELL_SIZE } from '../core/voxelMask.js';

export function diverCellVisualOffset(enemy, cell, time) {
  return (enemy.diver?.theme === 'snake' ? Math.sin(time * 7 + cell.gridY * 0.95) * CELL_SIZE * 0.32 : 0) + diverKickPose(enemy, cell).x;
}

export function diverKickPose(enemy, cell) {
  const kick = enemy.diver?.kick;
  if (!kick || cell.role !== 'diverLeg' || !cell.id.startsWith(kick.cellId.split('-')[0])) return { x: 0, y: 0, rotation: 0 };
  const swing = Math.sin(Math.min(1, kick.age / kick.duration) * Math.PI);
  const side = cell.id.startsWith('left') ? -1 : 1;
  return { x: side * CELL_SIZE * 3 * swing, y: -CELL_SIZE * 2 * swing, rotation: -side * swing * 0.8 };
}

export function drawDiverUnderlay(ctx, enemy, time) {
  if (!enemy.diver || enemy.destroyed) return;
  const theme = enemy.diver.theme;
  ctx.save();
  if (theme === 'insect') {
    for (const side of [-1, 1]) {
      if (!enemy.cells.some(c => c.id === `wing-${side < 0 ? 'left' : 'right'}` && !c.state.destroyed)) continue;
      ctx.save();
      ctx.translate(side * CELL_SIZE, -CELL_SIZE * 0.25);
      ctx.rotate(side * (0.45 + Math.sin(time * 44) * 0.28));
      ctx.fillStyle = 'rgba(199,246,232,0.65)';
      ctx.strokeStyle = '#81b8b0';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.ellipse(side * CELL_SIZE * 0.75, 0, CELL_SIZE * 1.4, CELL_SIZE * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * CELL_SIZE * 1.9, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (theme === 'walker') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#929fb0';
    for (const side of [-1, 1]) {
      const prefix = side < 0 ? 'left' : 'right';
      if (!enemy.cells.some(c => c.id.startsWith(prefix) && c.role === 'diverLeg' && !c.state.destroyed)) continue;
      const stride = Math.sin(time * 8 + side * Math.PI / 2) * 2;
      const kick = diverKickPose(enemy, { id: `${prefix}-foot`, role: 'diverLeg' });
      ctx.beginPath();
      ctx.moveTo(side * CELL_SIZE * 0.7, -CELL_SIZE * 1.3);
      ctx.lineTo(side * CELL_SIZE * 1.4, -CELL_SIZE * 0.4 + stride);
      ctx.lineTo(side * CELL_SIZE + kick.x, CELL_SIZE * 0.5 + stride + kick.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawDiverOverlay(ctx, enemy, time) {
  if (!enemy.diver || enemy.destroyed) return;
  const theme = enemy.diver.theme;
  ctx.save();
  if (theme === 'sailboat' && enemy.cells.some(c => c.id === 'mast' && !c.state.destroyed)) {
    ctx.strokeStyle = '#b9a47b';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -CELL_SIZE * 1.8);
    ctx.lineTo(0, CELL_SIZE * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#efe9ce';
    ctx.beginPath();
    ctx.moveTo(0, -CELL_SIZE * 1.8);
    ctx.lineTo(CELL_SIZE * (1.55 + Math.sin(time * 3) * 0.08), CELL_SIZE * 0.5);
    ctx.lineTo(CELL_SIZE * 0.12, CELL_SIZE * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  if (theme === 'motorcycle') {
    ctx.strokeStyle = '#dfded1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-CELL_SIZE * 0.7, -CELL_SIZE * 0.6);
    ctx.lineTo(CELL_SIZE * 0.7, -CELL_SIZE * 0.6);
    ctx.stroke();
  }
  if (theme === 'ghost') {
    ctx.fillStyle = '#ff5574';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * CELL_SIZE * 0.25, -CELL_SIZE * 0.9, 0.8 + Math.sin(time * 8) * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
