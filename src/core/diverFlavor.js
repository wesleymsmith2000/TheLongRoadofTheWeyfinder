import { angleDelta, clamp } from './math.js';
import { roadOffsetToWorld, worldToRoadOffset } from './camera.js';
import { arcadePlayBounds } from './arcadeMode.js';
import { CELL_SIZE } from './voxelMask.js';
import { diverVisibleLimits, ensureDiverOrbitBlades, releaseDiverBlades, startDiverSpiral } from './diverAttacks.js';

const WEAVE_ZONES = ['StarlightRoad', 'TwilightCrossroads', 'ShadowedRoad'];
export function diverApproachPoint(game, zone, x) {
  const bounds = arcadePlayBounds(game.road);
  const rearEntry = zone === 'DigitizedStream' || WEAVE_ZONES.includes(zone);
  return roadOffsetToWorld(rearEntry ? { x: (x < 0 ? -1 : 1) * ((game.road.viewWidth ?? game.road.halfWidth * 2) * 0.5 - CELL_SIZE * 3), y: bounds.behind * 0.94 } : { x, y: -bounds.ahead * 0.94 }, game.road);
}
export function diverBodyWidth(enemy) {
  const xs = enemy.cells.filter(cell => !cell.state.destroyed).map(cell => cell.gridX);
  return Math.max(CELL_SIZE, (Math.max(...xs) - Math.min(...xs) + 1) * CELL_SIZE);
}

export function diverBodySpan(enemy) {
  const ys = enemy.cells.filter(cell => !cell.state.destroyed).map(cell => cell.gridY);
  return Math.max(diverBodyWidth(enemy), (Math.max(...ys) - Math.min(...ys) + 1) * CELL_SIZE);
}

export function configureDiverFlavor(game, enemy, zone, entry = true) {
  if (game.runMode !== 'arcade') return;
  const state = enemy.diver;
  state.zone = zone;
  if (!entry || (zone !== 'DigitizedStream' && !WEAVE_ZONES.includes(zone))) return;
  const limits = diverVisibleLimits(game, enemy);
  const side = worldToRoadOffset(enemy, game.road).x < 0 ? -1 : 1;
  const point = roadOffsetToWorld({ x: side < 0 ? limits.left : limits.right, y: limits.bottom + enemy.radius }, game.road);
  enemy.x = point.x; enemy.y = point.y;
  state.speed = state.profile.approachSpeed;
  if (zone === 'DigitizedStream') beginInsectOrbit(game, enemy);
  else beginWeave(game, enemy, worldToRoadOffset(enemy, game.road));
}

function phase(state, next) { state.phase = next; state.phaseAge = 0; }

function beginInsectOrbit(game, enemy) {
  const state = enemy.diver, bounds = arcadePlayBounds(game.road);
  const width = diverBodyWidth(enemy);
  state.orbit = {
    center: { x: game.rng.range(-0.45, 0.45) * game.road.halfWidth, y: game.rng.range(-bounds.ahead * 0.9, -bounds.ahead + (bounds.ahead + bounds.behind) * 0.23) },
    radius: width, minRadius: width, maxRadius: width * 5, radialSpeed: 0, noiseIn: 0,
    angle: game.rng.range(0, Math.PI * 2), swept: 0,
  };
  phase(state, 'orbitTransit');
}

function beginWeave(game, enemy, position) {
  const state = enemy.diver, limits = diverVisibleLimits(game, enemy);
  state.weave = { passes: 4 + Math.floor(game.rng.next() * 2), completed: 0, startY: position.y, targetX: position.x < 0 ? limits.right : limits.left, turn: null };
  phase(state, 'weave');
}

function moveToward(state, position, target, speed, dt) {
  const dx = target.x - position.x, dy = target.y - position.y, distance = Math.hypot(dx, dy);
  state.roadAngle = Math.atan2(dy, dx);
  const step = Math.min(distance, speed * dt);
  position.x += Math.cos(state.roadAngle) * step;
  position.y += Math.sin(state.roadAngle) * step;
  return distance <= Math.max(0.2, speed * dt);
}

export function stepDiverFlavor(game, enemy, position, dt) {
  const state = enemy.diver;
  if (!state.zone || game.runMode !== 'arcade') return false;
  const bounds = arcadePlayBounds(game.road), top = -bounds.ahead * 0.72;
  const speed = state.profile.climbSpeed * (enemy.combatScale?.movementSpeed ?? 1);
  if (state.zone === 'FreedomsPass' && state.phase === 'dive') {
    ensureDiverOrbitBlades(game, enemy);
    state.bladeOrbitAge += dt;
  }
  if (state.phase === 'orbitTransit') {
    const orbit = state.orbit;
    const target = { x: orbit.center.x + Math.cos(orbit.angle) * orbit.radius, y: orbit.center.y + Math.sin(orbit.angle) * orbit.radius * 0.55 };
    if (moveToward(state, position, target, speed, dt)) phase(state, 'orbit');
    return true;
  }
  if (state.phase === 'orbit') {
    const orbit = state.orbit;
    orbit.noiseIn -= dt;
    while (orbit.noiseIn <= 0) {
      orbit.radialSpeed = clamp(orbit.radialSpeed * 0.8 + game.rng.range(-1, 1) * orbit.minRadius * 1.3, -orbit.minRadius * 2.5, orbit.minRadius * 2.5);
      orbit.noiseIn += 0.12;
    }
    orbit.radius += orbit.radialSpeed * dt;
    if (orbit.radius < orbit.minRadius || orbit.radius > orbit.maxRadius) {
      orbit.radius = clamp(orbit.radius, orbit.minRadius, orbit.maxRadius);
      orbit.radialSpeed *= -0.8;
    }
    const turn = 1.8 * dt;
    orbit.angle += turn; orbit.swept += turn;
    const before = { ...position };
    position.x = orbit.center.x + Math.cos(orbit.angle) * orbit.radius;
    position.y = orbit.center.y + Math.sin(orbit.angle) * orbit.radius * 0.55;
    state.roadAngle = Math.atan2(position.y - before.y, position.x - before.x);
    if (orbit.swept >= Math.PI * 8) phase(state, 'regroup');
    return true;
  }
  if (state.phase === 'weave') {
    const weave = state.weave, limits = diverVisibleLimits(game, enemy);
    if (weave.turn) {
      weave.turn.age += dt;
      const t = clamp(weave.turn.age / 0.45, 0, 1);
      const side = weave.turn.side;
      position.x = weave.turn.x - side * CELL_SIZE * 2.5 * Math.sin(t * Math.PI);
      position.y = weave.turn.y - CELL_SIZE * Math.sin(t * Math.PI / 2);
      state.roadAngle += angleDelta(state.roadAngle, side > 0 ? Math.PI : 0) * Math.min(1, dt * 8);
      if (t === 1) weave.turn = null;
    } else {
      const targetY = weave.startY + (top - weave.startY) * (weave.completed + 1) / weave.passes;
      if (moveToward(state, position, { x: weave.targetX, y: targetY }, speed, dt)) {
        weave.completed++;
        startDiverSpiral(enemy, state.zone === 'ShadowedRoad' ? 'mortar' : state.zone === 'TwilightCrossroads' ? 'flechette' : 'blade');
        if (weave.completed >= weave.passes) phase(state, 'regroup');
        else {
          const side = weave.targetX > 0 ? 1 : -1;
          weave.turn = { age: 0, x: position.x, y: position.y, side };
          weave.targetX = side > 0 ? limits.left : limits.right;
        }
      }
    }
    return true;
  }
  if (state.phase === 'ricochet') {
    const limits = diverVisibleLimits(game, enemy);
    state.bladeOrbitAge += dt;
    position.x += Math.cos(state.roadAngle) * speed * dt;
    position.y += Math.sin(state.roadAngle) * speed * dt;
    if ((position.x <= limits.left && Math.cos(state.roadAngle) < 0) || (position.x >= limits.right && Math.cos(state.roadAngle) > 0)) {
      position.x = clamp(position.x, limits.left, limits.right);
      state.roadAngle = Math.PI - state.roadAngle; state.ricochets++;
    }
    if ((position.y <= limits.top && Math.sin(state.roadAngle) < 0) || (position.y >= limits.bottom && Math.sin(state.roadAngle) > 0)) {
      position.y = clamp(position.y, limits.top, limits.bottom);
      state.roadAngle = -state.roadAngle; state.ricochets++;
    }
    if (state.ricochets >= 5) releaseDiverBlades(game, enemy);
    return true;
  }
  if (state.phase === 'regroup') {
    if (moveToward(state, position, { x: clamp(worldToRoadOffset(game.vehicle, game.road).x, -game.road.halfWidth * 0.7, game.road.halfWidth * 0.7), y: top }, speed * 1.25, dt)) {
      state.bladeCycle = false;
      state.roadAngle = -Math.PI / 2; state.trackedX = position.x;
      phase(state, 'track');
    }
    return true;
  }
  if (state.phase === 'snakeRecoil') {
    const recoil = state.snakeRecoil;
    const t = clamp(state.phaseAge / 0.25, 0, 1);
    position.x = recoil.x + Math.cos(recoil.angle) * recoil.distance * t;
    position.y = recoil.y + Math.sin(recoil.angle) * recoil.distance * t;
    if (state.phaseAge >= 0.25) { phase(state, 'snakeVolley'); startDiverSpiral(enemy, 'snake'); }
    return true;
  }
  if (state.phase === 'snakeVolley') {
    if (state.phaseAge >= 1.1) {
      enemy.reactionCueQueue ??= [];
      enemy.reactionCueQueue.push({ text: '💨', age: 0, lifetime: 1, x: 0, y: -enemy.radius, size: 12 });
      enemy.phasedOut = true; enemy.renderAlpha = 0.12;
      phase(state, 'snakeVanish');
    }
    return true;
  }
  if (state.phase === 'snakeVanish') {
    if (state.phaseAge >= 0.5) {
      position.x = clamp(worldToRoadOffset(game.vehicle, game.road).x, -game.road.halfWidth * 0.7, game.road.halfWidth * 0.7);
      position.y = top;
      enemy.phasedOut = false; enemy.renderAlpha = 1;
      state.trackedX = position.x; phase(state, 'track');
    }
    return true;
  }
  if (state.phase === 'return') {
    if (state.zone === 'DigitizedStream') { beginInsectOrbit(game, enemy); return true; }
    if (WEAVE_ZONES.includes(state.zone)) { beginWeave(game, enemy, position); return true; }
  }
  return false;
}
