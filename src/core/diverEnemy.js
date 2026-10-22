import { updateDiverDamageState } from './diverDamage.js';
import { DEFAULT_LEVEL_MUSIC } from './levelMusic.js';
import { angleDelta, clamp } from './math.js';
import { worldToRoadOffset, roadOffsetToWorld } from './camera.js';
import { createEnemy, harvestEnemyScrap, traceEnemyVoxelRay } from './enemy.js';
import { createCombatProjectile, arcadeEnemyFireRateScale, arcadePlayBounds } from './arcadeMode.js';
import { CELL_SIZE } from './voxelMask.js';
import { emitSoundEvent, SOUND_EVENTS } from './soundEvents.js';
import pack from '../../content/enemies/arcade_divers.json' with { type: 'json' };
import motorcycle from '../../content/constructs/diver_motorcycle.json' with { type: 'json' };
import sailboat from '../../content/constructs/diver_sailboat.json' with { type: 'json' };
import insect from '../../content/constructs/diver_insect.json' with { type: 'json' };
import walker from '../../content/constructs/diver_walker.json' with { type: 'json' };
import ghost from '../../content/constructs/diver_ghost.json' with { type: 'json' };
import snake from '../../content/constructs/diver_snake.json' with { type: 'json' };
import burrower from '../../content/constructs/diver_burrower.json' with { type: 'json' };

export const DIVER_CONSTRUCTS = { motorcycle, sailboat, insect, walker, ghost, snake, burrower };
export const DIVER_VARIANTS = pack.variants;
export const DIVER_MIN_WAVES = 2;
export const DIVER_WAVE_INTERVAL = [60, 240];
const UP = -Math.PI / 2;
const ZONES = ['TheWeyfindersRoad', 'DigitizedStream', 'PiratesRoad', 'StarlightRoad', 'TwilightCrossroads', 'ShadowedRoad', 'GhostForrest', 'ShadowedDesert', 'FreedomsPass', 'SteppesOfApollonSkoteinos'];

function zoneForTrack(track = '') {
  if (/GhostForrest/.test(track)) return 'GhostForrest';
  return ZONES.find(zone => track.startsWith(zone)) ?? null;
}

export function diverLevelContext(level, tracks = DEFAULT_LEVEL_MUSIC) {
  const index = Math.max(0, level - 1) % Math.max(1, tracks.length);
  let zone = 'TheWeyfindersRoad';
  let zoneLevel = 0;
  for (let i = 0; i <= index; i++) {
    const next = zoneForTrack(tracks[i]) ?? zone;
    if (next !== zone) zoneLevel = 0;
    zone = next;
    zoneLevel++;
  }
  const theme = ({ DigitizedStream: 'insect', PiratesRoad: 'sailboat', TwilightCrossroads: 'walker', ShadowedRoad: 'walker', GhostForrest: 'ghost', ShadowedDesert: 'snake', FreedomsPass: 'burrower' })[zone] ?? 'motorcycle';
  return { zone, zoneNumber: Math.max(1, ZONES.indexOf(zone) + 1), zoneLevel, theme };
}

export function validateDiverPack(definition) {
  const errors = [];
  if (definition?.schemaVersion !== '0.1' || !Array.isArray(definition?.variants)) return { valid: false, errors: ['Expected a 0.1 Diver variant pack.'] };
  const ids = new Set();
  for (const variant of definition.variants) {
    if (!variant || typeof variant !== 'object') { errors.push('Diver variants must be objects.'); continue; }
    if (!DIVER_CONSTRUCTS[variant.id] || ids.has(variant.id)) errors.push(`Unknown or duplicate Diver variant: ${variant.id}`);
    ids.add(variant.id);
    if (variant.construct !== DIVER_CONSTRUCTS[variant.id]?.assetId) errors.push(`Wrong construct for ${variant.id}`);
    for (const field of ['trackingSeconds', 'approachSpeed', 'climbSpeed', 'turnSpeed', 'turnRadiusRatio', 'turnRate', 'diveSpeed', 'acceleration', 'trackingGain', 'trackingDamping', 'trackingLag', 'maxTrackingSpeed', 'fireInterval', 'mortarInterval']) {
      if (!Number.isFinite(variant.profile?.[field]) || variant.profile[field] <= 0) errors.push(`${variant.id}.profile.${field} must be positive.`);
    }
  }
  for (const theme of Object.keys(DIVER_CONSTRUCTS)) if (!ids.has(theme)) errors.push(`Missing Diver variant: ${theme}`);
  return { valid: errors.length === 0, errors };
}

export function createDiverEnemy(x, y, theme = 'motorcycle', options = {}) {
  const variant = DIVER_VARIANTS.find(v => v.id === theme);
  if (!variant) throw new Error(`Unknown Diver theme: ${theme}`);
  const enemy = createEnemy(x, y, DIVER_CONSTRUCTS[theme], [], { moduleScale: 1 });
  enemy.kind = 'diver';
  enemy.archetypeId = `diver.${theme}`;
  enemy.displayName = variant.displayName;
  enemy.palette = { ...variant.palette };
  enemy.presentation = { variant: `diver.${theme}` };
  enemy.visualHeading = (options.roadHeading ?? 0) + UP;
  enemy.collisionRotation = options.roadHeading ?? 0;
  enemy.renderHeadingOffset = Math.PI / 2;
  enemy.diver = {
    theme, phase: 'approach', phaseAge: 0, roadAngle: UP, speed: 0,
    profile: { ...variant.profile }, lateralSpeed: 0, trackedX: null,
    fireTimer: 0.4 + (options.phaseOffset ?? 0), mortarTimer: 2,
    initialCells: enemy.cells.length, ghostThreshold: 0, ghostPending: 0, ghostTimer: 0,
    burrowed: theme === 'burrower', thrusterActive: false,
    slitherPhase: options.phaseOffset ?? 0, particleTimer: 0,
  };
  if (theme === 'burrower') enemy.phasedOut = true;
  if (theme === 'walker') {
    enemy.elevation = { z: 0, canBeHitByGroundFire: true, arcCollision: true, layeredExposure: true };
  }
  return enemy;
}

export function resetDiverWaves(game) {
  game.diverWaves = game.runMode === 'arcade' && !game.sandbox?.enabled
    ? { level: game.level, wavesSpawned: 0, wavesCleared: 0, waitingForClear: false, nextIn: game.rng.range(...DIVER_WAVE_INTERVAL) }
    : null;
}

export function stepDiverWaves(game, dt, onSpawn = () => {}) {
  const state = game.diverWaves;
  if (!state || game.levelComplete || game.gameOver) return;
  if (game.enemies.some(e => e.diver && !e.destroyed)) return;
  if (state.waitingForClear) {
    state.wavesCleared++;
    state.waitingForClear = false;
    state.nextIn = game.rng.range(...DIVER_WAVE_INTERVAL);
  }
  state.nextIn = Math.max(0, state.nextIn - dt);
  if (state.nextIn > 0) return;
  const context = diverLevelContext(game.level, game.levelMusic);
  const count = 1 + Math.floor(game.rng.next() * 3) + context.zoneNumber + context.zoneLevel;
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : ((i / (count - 1)) * 2 - 1) * game.road.halfWidth * 0.72;
    const world = roadOffsetToWorld({ x, y: -arcadePlayBounds(game.road).ahead - 110 - i * CELL_SIZE * 3 }, game.road);
    const enemy = createDiverEnemy(world.x, world.y, context.theme, { roadHeading: game.road.heading, phaseOffset: game.rng.range(0, 1) });
    enemy.targetId = `diver:${game.level}:${state.wavesSpawned}:${i}`;
    if (context.zone === 'ShadowedRoad') enemy.palette = { ...enemy.palette, armor: '#444f5c', core: '#9aafbb', gun: '#ff884e' };
    onSpawn(enemy);
    game.enemies.push(enemy);
  }
  state.wavesSpawned++;
  state.waitingForClear = true;
}

export function diverWavesCleared(game) {
  return !game.diverWaves || (game.diverWaves.wavesSpawned >= DIVER_MIN_WAVES && !game.enemies.some(e => e.diver && !e.destroyed));
}

function setPhase(state, phase) {
  state.phase = phase;
  state.phaseAge = 0;
}

function beginTurn(game, enemy, position, phase, targetAngle) {
  const state = enemy.diver;
  const turnSpan = Math.min(game.road.halfHeight, game.road.halfWidth * 0.8);
  let radius = turnSpan * state.profile.turnRadiusRatio;
  let delta = angleDelta(state.roadAngle, targetAngle);
  const side = (position.x > 0 ? -1 : 1) * (phase === 'bottomTurn' ? -1 : 1);
  if (Math.sign(delta) !== side) delta += side * Math.PI * 2;
  if (phase === 'bottomTurn') {
    radius = Math.max(radius, Math.max(0, Math.abs(position.x) - game.road.halfWidth * 0.5) / Math.max(0.3, Math.abs(Math.sin(targetAngle) - Math.sin(state.roadAngle))));
  }
  state.turn = { origin: { ...position }, startAngle: state.roadAngle, delta, radius, duration: Math.max(0.25, Math.abs(delta) * radius / state.profile.turnSpeed) };
  setPhase(state, phase);
}

function stepTurn(state) {
  const turn = state.turn;
  const progress = clamp(state.phaseAge / turn.duration, 0, 1);
  state.roadAngle = turn.startAngle + turn.delta * progress;
  const signedRadius = Math.sign(turn.delta || 1) * turn.radius;
  return {
    x: turn.origin.x + signedRadius * (Math.sin(state.roadAngle) - Math.sin(turn.startAngle)),
    y: turn.origin.y + signedRadius * (Math.cos(turn.startAngle) - Math.cos(state.roadAngle)),
  };
}

// Owns movement and integration; standard lane steering and Arcade front bias
// must not overwrite this scripted cycle.
export function stepDiverEnemy(game, enemy, dt) {
  const state = enemy.diver;
  const profile = state.profile;
  let position = worldToRoadOffset(enemy, game.road);
  const previous = { x: enemy.x, y: enemy.y };
  const player = worldToRoadOffset(game.vehicle, game.road);
  const speedScale = enemy.combatScale?.movementSpeed ?? 1;
  const bounds = arcadePlayBounds(game.road);
  const top = -bounds.ahead * 0.72;
  state.phaseAge += dt;
  updateDiverDamageState(enemy, dt);

  if (state.phase === 'approach') {
    state.roadAngle = UP;
    position.y = Math.min(top, position.y + profile.approachSpeed * dt);
    if (position.y >= top) {
      setPhase(state, 'track');
      state.trackedX = position.x;
      if (state.theme === 'burrower') emitDiverParticles(game, enemy, 'burst', 14);
    }
  } else if (state.phase === 'track') {
    state.roadAngle = UP;
    state.trackedX ??= position.x;
    state.trackedX += (clamp(player.x, -game.road.halfWidth * 0.72, game.road.halfWidth * 0.72) - state.trackedX) * (1 - Math.exp(-profile.trackingLag * dt));
    state.lateralSpeed += ((state.trackedX - position.x) * profile.trackingGain - state.lateralSpeed * profile.trackingDamping) * dt;
    state.lateralSpeed = clamp(state.lateralSpeed, -profile.maxTrackingSpeed, profile.maxTrackingSpeed);
    position.x += state.lateralSpeed * dt;
    position.y += clamp((top - position.y) * 2, -12, 12) * dt;
    if (state.phaseAge >= profile.trackingSeconds) setPhase(state, 'climb');
  } else if (state.phase === 'climb') {
    state.roadAngle = UP;
    position.y -= profile.turnSpeed * dt;
    if (position.y < -bounds.ahead - game.road.halfHeight * 0.45) beginTurn(game, enemy, position, 'topTurn', Math.PI / 2);
  } else if (state.phase === 'topTurn' || state.phase === 'bottomTurn') {
    if (state.theme === 'sailboat') state.turn.origin.x += state.lateralSpeed * dt * 0.3;
    position = stepTurn(state);
    if (state.phaseAge >= state.turn.duration) {
      if (state.phase === 'topTurn') {
        state.diveAngle = Math.atan2(player.y - position.y, player.x - position.x);
        setPhase(state, 'aim');
      } else {
        state.roadAngle = UP;
        state.speed = profile.turnSpeed;
        setPhase(state, 'return');
      }
    }
  } else if (state.phase === 'aim') {
    const turn = clamp(angleDelta(state.roadAngle, state.diveAngle), -profile.turnRate * dt, profile.turnRate * dt);
    state.roadAngle += turn;
    if (Math.abs(angleDelta(state.roadAngle, state.diveAngle)) < 0.025) {
      state.roadAngle = state.diveAngle;
      state.speed = profile.turnSpeed * 0.5;
      setPhase(state, 'dive');
    }
  } else if (state.phase === 'dive' || state.phase === 'return') {
    state.speed = Math.min((state.phase === 'dive' ? profile.diveSpeed : profile.climbSpeed) * speedScale, state.speed + profile.acceleration * speedScale * dt);
    position.x += Math.cos(state.roadAngle) * state.speed * dt;
    position.y += Math.sin(state.roadAngle) * state.speed * dt;
    if (state.theme === 'snake') {
      const next = state.slitherPhase + dt * 6;
      const wiggle = (Math.sin(next) - Math.sin(state.slitherPhase)) * CELL_SIZE * 0.9;
      position.x -= Math.sin(state.roadAngle) * wiggle;
      position.y += Math.cos(state.roadAngle) * wiggle;
      state.slitherPhase = next;
    }
    if (state.phase === 'dive' && position.y > bounds.behind + game.road.halfHeight * 0.45) {
      beginTurn(game, enemy, position, 'bottomTurn', UP);
    } else if (state.phase === 'return' && position.y < -bounds.ahead - 110) {
      state.speed = 0;
      setPhase(state, 'approach');
    }
  }

  const world = roadOffsetToWorld(position, game.road);
  enemy.x = world.x;
  enemy.y = world.y;
  enemy.vx = dt > 0 ? (world.x - previous.x) / dt : 0;
  enemy.vy = dt > 0 ? (world.y - previous.y) / dt : 0;
  if (state.theme === 'sailboat') {
    state.sailVisualAngle ??= state.roadAngle;
    state.sailVisualAngle += angleDelta(state.sailVisualAngle, state.roadAngle) * (1 - Math.exp(-4 * dt));
  }
  enemy.visualHeading = game.road.heading + (state.sailVisualAngle ?? state.roadAngle);
  enemy.collisionRotation = enemy.visualHeading + Math.PI / 2;
  if (state.theme === 'burrower') {
    state.burrowed = ['approach', 'bottomTurn', 'return'].includes(state.phase);
    enemy.phasedOut = state.burrowed;
  }
  stepDiverFire(game, enemy, dt);
  state.particleTimer -= dt;
  if (state.particleTimer <= 0 && (state.burrowed || state.thrusterActive)) {
    emitDiverParticles(game, enemy, state.burrowed ? 'dirt' : 'thruster', 2);
    state.particleTimer = 0.045;
  }
}

function stepDiverFire(game, enemy, dt) {
  const state = enemy.diver;
  const fireScale = arcadeEnemyFireRateScale(game) * (enemy.combatScale?.attackRate ?? 1);
  state.fireTimer = Math.max(0, state.fireTimer - dt * fireScale);
  state.mortarTimer = Math.max(0, state.mortarTimer - dt * fireScale);
  if (enemy.phasedOut || !['track', 'dive'].includes(state.phase)) return;
  if (!enemy.cells.some(c => c.type === 'gun' && !c.state.destroyed && c.state.deviceIntegrity > 0.1)) return;
  const damageScale = enemy.combatScale?.damage ?? 1;
  if (state.fireTimer === 0) {
    const angle = enemy.visualHeading;
    const offset = CELL_SIZE * 2;
    game.enemyProjectiles.push(createCombatProjectile(game, enemy.x + Math.cos(angle) * offset, enemy.y + Math.sin(angle) * offset, Math.cos(angle) * 180, Math.sin(angle) * 180, {
      team: 'enemy', weapon: 'diver-gun', angle, radius: 1.6, damage: 8 * damageScale,
      impulse: 35, lifetime: 3.5, sourceEnemy: enemy, color: enemy.palette.gun,
    }));
    state.fireTimer = state.profile.fireInterval;
    emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
  }
  if (state.theme === 'sailboat' && state.phase === 'track' && state.mortarTimer === 0 && enemy.cells.some(c => c.id === 'mortar' && !c.state.destroyed)) {
    const flightTime = 1.7;
    const gravity = 96;
    const target = { x: game.vehicle.x, y: game.vehicle.y };
    game.enemyProjectiles.push(createCombatProjectile(game, enemy.x, enemy.y, (target.x - enemy.x) / flightTime, (target.y - enemy.y) / flightTime, {
      team: 'enemy', weapon: 'diver-mortar', behavior: 'arc', damage: 0, radius: 2.2,
      verticalVelocity: gravity * flightTime / 2, gravity, targetHint: target,
      detonateAtTarget: true, lifetime: flightTime + 0.5, sourceEnemy: enemy,
      blastOnExpire: { radius: CELL_SIZE * 5, damage: 12 * damageScale, impulse: 55 },
    }));
    state.mortarTimer = state.profile.mortarInterval;
    emitSoundEvent(game, SOUND_EVENTS.ENEMY_MORTAR_FIRE);
  }
}

function emitDiverParticles(game, enemy, kind, count) {
  const state = enemy.diver;
  const angle = (enemy.visualHeading ?? 0) + Math.PI;
  for (let i = 0; i < count; i++) {
    const spread = game.rng.range(-0.8, 0.8);
    const speed = kind === 'burst' ? game.rng.range(15, 45) : game.rng.range(8, 22);
    const life = kind === 'thruster' ? 0.18 : kind === 'burst' ? 0.6 : 0.35;
    game.smokeParticles.push({
      x: enemy.x + Math.cos(angle) * CELL_SIZE, y: enemy.y + Math.sin(angle) * CELL_SIZE,
      vx: Math.cos(angle + spread) * speed, vy: Math.sin(angle + spread) * speed,
      radius: kind === 'thruster' ? 1.7 : game.rng.range(1.4, 3.3),
      color: kind === 'thruster' ? (i % 2 ? '#ff9d24' : '#e54020') : (i % 2 ? '#9c7045' : '#68482f'),
      lifetime: life, maxLifetime: life, growth: 3, weapon: `diver-${kind}`,
      z: kind === 'thruster' ? enemy.elevation?.z ?? 0 : 0,
    });
  }
  if (game.smokeParticles.length > 650) game.smokeParticles.splice(0, game.smokeParticles.length - 650);
}

export function nearestHopperDiverPrey(game, hopper, range = CELL_SIZE * 7.5) {
  return game.enemies.reduce((best, enemy) => {
    if (!enemy.diver || enemy.diver.theme !== 'insect' || enemy.destroyed || enemy.phasedOut) return best;
    const distance = Math.hypot(enemy.x - hopper.x, enemy.y - hopper.y);
    if (distance > range) return best;
    return !best || distance < Math.hypot(best.x - hopper.x, best.y - hopper.y) ? enemy : best;
  }, null);
}

export function hitDiverWithHopperBeam(game, beam, onDestroyed = () => {}) {
  if (beam.weapon !== 'hopper-prey-beam' || !beam.sourceEnemy || beam.sourceEnemy.destroyed) return false;
  const prey = game.enemies.filter(enemy => enemy.diver?.theme === 'insect' && !enemy.destroyed && !enemy.phasedOut);
  const hit = traceEnemyVoxelRay(prey, beam, beam.angle, beam.length, 0, { groundOnly: false });
  if (!hit.enemy) return false;
  const enemy = hit.enemy;
  const scrap = harvestEnemyScrap(enemy, game.rng);
  const scale = enemy.scrapDropScale ?? 1;
  const total = scrap.reduce((sum, p) => sum + Math.max(1, Math.round(p.value * scale)), 0);
  const hopper = beam.sourceEnemy;
  hopper.hopperConsumedScrap = (hopper.hopperConsumedScrap ?? 0) + Math.floor(total * 0.5);
  enemy.dropNoScrap = true;
  enemy.diver.consumedByHopper = true;
  enemy.destroyed = true;
  for (let i = 0; i < Math.min(18, scrap.length); i++) {
    const p = scrap[i];
    game.smokeParticles.push({ x: p.x, y: p.y, vx: 0, vy: 0, radius: 1.2, color: '#e9d18c', lifetime: 0.7, maxLifetime: 0.7, growth: 0, attractorEnemy: hopper, weapon: 'hopper-scrap-suction' });
  }
  onDestroyed(enemy);
  return true;
}

const packReport = validateDiverPack(pack);
if (!packReport.valid) throw new Error(`Invalid Arcade Diver content: ${packReport.errors.join(' ')}`);
