import { localToWorld, worldToLocal } from './math.js';
import { worldToRoadOffset } from './camera.js';
import { CELL_SIZE, VOXEL_SIZE } from './voxelMask.js';
import { recalculateCell } from './cell.js';
import { applyVehicleDamage, recalculateVehicle, updateStructure } from './vehicle.js';
import { diverBodySpan } from './diverFlavor.js';
import { diverContactStats } from './diverAttacks.js';

export function addDiverCue(body, text, lifetime = 1, delay = 0) {
  body.reactionCueQueue ??= [];
  const existingHint = text.length > 10 ? body.reactionCueQueue.find(cue => cue.text === text) : null;
  if (existingHint) { existingHint.age = 0; existingHint.lifetime = lifetime; return existingHint; }
  const radius = body.radius ?? Math.max(CELL_SIZE * 4, ...(body.cells ?? []).map(cell => Math.hypot(cell.gridX, cell.gridY) * CELL_SIZE + CELL_SIZE));
  const cue = { text, age: -delay, lifetime, x: 0, y: -radius - CELL_SIZE, rise: CELL_SIZE, size: text.length > 10 ? 20 : 13, growth: 1.2 };
  body.reactionCueQueue.push(cue);
  return cue;
}

export function stepPlayerDiverStatus(game, dt) {
  const vehicle = game.vehicle;
  for (const cue of vehicle.reactionCueQueue ?? []) cue.age += dt;
  vehicle.reactionCueQueue = (vehicle.reactionCueQueue ?? []).filter(cue => cue.age < cue.lifetime);
  if (game.runMode !== 'arcade') { vehicle.chillSpeedScale = 1; return; }
  if (vehicle.diverChill) {
    vehicle.diverChill.remaining = Math.max(0, vehicle.diverChill.remaining - dt);
    if (vehicle.diverChill.remaining === 0) vehicle.diverChill.stacks = 0;
  }
  vehicle.chillSpeedScale = 1 - 0.15 * (vehicle.diverChill?.stacks ?? 0);
}

// Use actual surviving player voxels, rather than a fixed radius around the core.
export function diverPlayerContact(game, enemy) {
  const local = worldToLocal(enemy, game.vehicle);
  const reach = Math.max(CELL_SIZE, Math.min(enemy.radius * 0.6, CELL_SIZE * 2));
  let nearest = null;
  for (const cell of game.vehicle.cells) {
    if (!cell.attached || cell.state.destroyed) continue;
    if (Math.abs(cell.gridX * CELL_SIZE - local.x) > reach + CELL_SIZE || Math.abs(cell.gridY * CELL_SIZE - local.y) > reach + CELL_SIZE) continue;
    for (let row = 0; row < cell.mask.length; row++) {
      for (let col = 0; col < cell.mask[row].length; col++) {
        const voxel = cell.mask[row][col];
        if (voxel.hp <= 0) continue;
        const point = { x: cell.gridX * CELL_SIZE + (col + 0.5) * VOXEL_SIZE - CELL_SIZE / 2, y: cell.gridY * CELL_SIZE + (row + 0.5) * VOXEL_SIZE - CELL_SIZE / 2 };
        const distance = Math.hypot(point.x - local.x, point.y - local.y);
        if (distance <= reach + VOXEL_SIZE && (!nearest || distance < nearest.distance)) nearest = { cell, voxel, point, distance };
      }
    }
  }
  return nearest;
}

function attachFly(game, enemy, contact) {
  const state = enemy.diver;
  state.attachment = { cellId: contact.cell.id, local: contact.point, consumed: 0, tickIn: 0.5, knockbackSerial: game.vehicle.knockbackSerial ?? 0, detachedCells: game.vehicle.cells.filter(cell => !cell.attached).length };
  state.phase = 'attached'; state.phaseAge = 0;
  enemy.vx = enemy.vy = 0;
  addDiverCue(game.vehicle, 'use boosters to detach the fly!', 3);
}

export function detachDiverFly(game, enemy) {
  if (!enemy.diver?.attachment) return;
  enemy.diver.attachment = null;
  enemy.diver.phase = 'regroup'; enemy.diver.phaseAge = 0;
  enemy.diver.contactReadyAt = game.time + 1.5;
  enemy.diver.speed = enemy.diver.profile.climbSpeed;
  // A visible shove away prevents immediate reattachment at the same cell.
  const dx = enemy.x - game.vehicle.x, dy = enemy.y - game.vehicle.y, length = Math.hypot(dx, dy) || 1;
  enemy.x += (dx / length || 1) * CELL_SIZE * 3;
  enemy.y += dy / length * CELL_SIZE * 3;
}

export function dislodgeDiverFlies(game) {
  for (const enemy of game.enemies) {
    const attached = enemy.diver?.attachment;
    if (!attached) continue;
    if (enemy.destroyed) { enemy.diver.attachment = null; continue; }
    if ((game.boost?.activeTime ?? 0) > 0 || (game.vehicle.knockbackSerial ?? 0) !== attached.knockbackSerial || !game.vehicle.cells.some(cell => cell.id === attached.cellId && cell.attached && !cell.state.destroyed)) detachDiverFly(game, enemy);
  }
}

export function stepAttachedDiver(game, enemy, dt) {
  const attached = enemy.diver.attachment;
  if (!attached) return false;
  if (enemy.destroyed) { enemy.diver.attachment = null; return true; }
  const cell = game.vehicle.cells.find(candidate => candidate.id === attached.cellId);
  if (!cell?.attached || cell.state.destroyed || (game.boost?.activeTime ?? 0) > 0 || (game.vehicle.knockbackSerial ?? 0) !== attached.knockbackSerial) { detachDiverFly(game, enemy); return true; }
  const point = localToWorld(attached.local, game.vehicle);
  enemy.x = point.x; enemy.y = point.y;
  enemy.vx = game.vehicle.vx; enemy.vy = game.vehicle.vy;
  enemy.visualHeading = game.vehicle.heading - Math.PI / 2;
  enemy.collisionRotation = game.vehicle.heading;
  attached.tickIn -= dt;
  while (attached.tickIn <= 1e-9) {
    attached.tickIn += 0.5;
    const live = cell.mask.flatMap((row, rowIndex) => row.map((voxel, colIndex) => ({ voxel, x: cell.gridX * CELL_SIZE + (colIndex + 0.5) * VOXEL_SIZE - CELL_SIZE / 2, y: cell.gridY * CELL_SIZE + (rowIndex + 0.5) * VOXEL_SIZE - CELL_SIZE / 2 }))).filter(entry => entry.voxel.hp > 0);
    live.sort((a, b) => Math.hypot(a.x - attached.local.x, a.y - attached.local.y) - Math.hypot(b.x - attached.local.x, b.y - attached.local.y));
    const voxel = live[0]?.voxel;
    if (!voxel) { detachDiverFly(game, enemy); break; }
    voxel.hp = Math.max(0, voxel.hp - 1);
    if (voxel.hp === 0) attached.consumed++;
    recalculateCell(cell);
    updateStructure(game.vehicle); recalculateVehicle(game.vehicle);
    const detached = game.vehicle.cells.filter(candidate => !candidate.attached).length;
    if (attached.consumed >= 8 || detached > attached.detachedCells || !cell.attached || cell.state.destroyed) { detachDiverFly(game, enemy); break; }
  }
  return true;
}

export function handleDiverContacts(game, { spinout = () => {}, blast = () => {} } = {}) {
  if (game.runMode !== 'arcade') return;
  const stats = diverContactStats();
  const hullRadius = Math.max(CELL_SIZE, ...game.vehicle.cells.filter(cell => cell.attached && !cell.state.destroyed).map(cell => Math.hypot(cell.gridX, cell.gridY) * CELL_SIZE + CELL_SIZE));
  for (const enemy of game.enemies) {
    const state = enemy.diver;
    if (!state?.zone || enemy.destroyed || enemy.phasedOut || state.gapExit || state.attachment || enemy.carRuntime?.spinout) continue;
    if (Math.hypot(enemy.x - game.vehicle.x, enemy.y - game.vehicle.y) > hullRadius + enemy.radius) { state.contactOverlapping = false; continue; }
    const contact = diverPlayerContact(game, enemy);
    if (!contact) { state.contactOverlapping = false; continue; }
    if (state.contactOverlapping || (state.contactReadyAt ?? 0) > game.time || (game.boost?.activeTime ?? 0) > 0) continue;
    state.contactOverlapping = true;
    state.contactReadyAt = game.time + 0.75;
    const point = localToWorld(contact.point, game.vehicle);
    const length = Math.hypot(point.x - enemy.x, point.y - enemy.y) || 1;
    const direction = { x: (point.x - enemy.x) / length, y: (point.y - enemy.y) / length };
    if (state.zone === 'TheWeyfindersRoad' && state.phase === 'dive') {
      applyVehicleDamage(game.vehicle, point, CELL_SIZE * 3, stats.roadDamage, stats.roadImpulse, direction);
      blast(enemy, stats);
      spinout(enemy);
    } else if (state.zone === 'DigitizedStream') attachFly(game, enemy, contact);
    else if (['StarlightRoad', 'TwilightCrossroads', 'ShadowedRoad'].includes(state.zone)) {
      const localPlayer = worldToLocal(game.vehicle, { x: enemy.x, y: enemy.y, heading: enemy.collisionRotation ?? 0 });
      const side = localPlayer.x < 0 ? 'left' : 'right';
      const legs = enemy.cells.filter(cell => cell.role === 'diverLeg' && !cell.state.destroyed);
      const leg = legs.find(cell => cell.id.startsWith(side)) ?? legs[0];
      if (!leg) continue;
      state.kick = { cellId: leg.id, age: 0, duration: 0.65 };
      applyVehicleDamage(game.vehicle, point, CELL_SIZE * 2, stats.kickDamage, stats.kickImpulse, direction);
      addDiverCue(enemy, '😠', 0.5); addDiverCue(enemy, '🤬', 0.5, 0.4); addDiverCue(enemy, '😤', 0.9, 0.9);
    } else if (state.zone === 'GhostForrest') {
      const chill = game.vehicle.diverChill ??= { stacks: 0, remaining: 0 };
      chill.stacks = Math.min(3, chill.stacks + 1); chill.remaining = 3;
      game.vehicle.chillSpeedScale = 1 - chill.stacks * 0.15;
      game.vehicle.reactionCueQueue = (game.vehicle.reactionCueQueue ?? []).filter(cue => !cue.diverChillCue);
      for (const [text, duration, delay] of [['🥶', 0.8, 0], ['🥶 ❄️', 0.8, 0.65], ['🧊 🥶', 1, 1.3]]) addDiverCue(game.vehicle, text, duration, delay).diverChillCue = true;
    } else if (state.zone === 'ShadowedDesert' && !['snakeRecoil', 'snakeVolley', 'snakeVanish'].includes(state.phase)) {
      const position = worldToRoadOffset(enemy, game.road), player = worldToRoadOffset(game.vehicle, game.road);
      state.snakeRecoil = { x: position.x, y: position.y, angle: Math.atan2(position.y - player.y, position.x - player.x), distance: diverBodySpan(enemy) * 2 };
      state.phase = 'snakeRecoil'; state.phaseAge = 0;
      addDiverCue(enemy, '😲', 0.9);
    }
  }
}
