import { CELL_SIZE } from './voxelMask.js';
import { clamp } from './math.js';
import { resolveEnvironmentLighting } from './renderMaterial.js';

export const DEFAULT_DYNAMIC_LIGHT_BUDGET = 24;

export function normalizeDynamicLight(light, fallback = {}) {
  if (!light || typeof light !== 'object') return null;
  const radius = Number(light.radius ?? fallback.radius ?? 0);
  const intensity = Number(light.intensity ?? fallback.intensity ?? 1);
  if (!Number.isFinite(light.x) || !Number.isFinite(light.y) || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(intensity) || intensity <= 0) return null;
  return {
    x: light.x,
    y: light.y,
    radius,
    intensity: clamp(intensity, 0, 4),
    color: typeof light.color === 'string' ? light.color : fallback.color ?? '#fff1c8',
    type: light.type ?? fallback.type ?? 'point',
    priority: Number.isFinite(light.priority) ? light.priority : fallback.priority ?? 1,
    direction: light.direction ?? fallback.direction ?? null,
    coneAngle: Number.isFinite(light.coneAngle) ? light.coneAngle : fallback.coneAngle ?? Math.PI / 4,
    flicker: Number.isFinite(light.flicker) ? light.flicker : fallback.flicker ?? 0,
  };
}

export function collectDynamicLights(game, options = {}) {
  const lights = [];
  const environment = resolveEnvironmentLighting(game?.environmentLighting ?? game?.lighting ?? 'DAY');
  const scale = environment.dynamicLightScale * (options.dynamicLightScale ?? 1);
  const vehicle = game?.vehicle;
  if (vehicle && !game?.gameOver) {
    lights.push({
      x: vehicle.x,
      y: vehicle.y,
      radius: CELL_SIZE * 13,
      intensity: 0.16 * scale,
      color: '#c6f5ff',
      type: 'spot',
      direction: vehicle.heading,
      coneAngle: Math.PI / 3.4,
      priority: 120,
    });
  }
  if ((game?.boost?.activeTime ?? 0) > 0 && vehicle) {
    lights.push({
      x: vehicle.x,
      y: vehicle.y,
      radius: CELL_SIZE * 7,
      intensity: 0.28 * scale,
      color: '#83f7ff',
      priority: 110,
    });
  }
  addProjectileLights(lights, game?.playerProjectiles, scale, 44);
  addProjectileLights(lights, game?.enemyProjectiles, scale, 38);
  for (const particle of game?.smokeParticles ?? []) {
    if (!particle.light) continue;
    lights.push({
      x: particle.x,
      y: particle.y,
      radius: particle.light.radius ?? CELL_SIZE * 4,
      intensity: particle.light.intensity ?? 0.2,
      color: particle.light.color ?? particle.color ?? '#ff9b42',
      priority: particle.light.priority ?? 12,
    });
  }
  return prioritizeDynamicLights(lights, game?.camera, { maxLights: options.maxLights ?? DEFAULT_DYNAMIC_LIGHT_BUDGET });
}

export function prioritizeDynamicLights(lights, camera = null, options = {}) {
  const maxLights = Math.max(0, Math.floor(options.maxLights ?? DEFAULT_DYNAMIC_LIGHT_BUDGET));
  if (maxLights === 0) return [];
  return lights
    .map((light) => normalizeDynamicLight(light))
    .filter(Boolean)
    .sort((a, b) => lightScore(b, camera) - lightScore(a, camera))
    .slice(0, maxLights);
}

function addProjectileLights(lights, projectiles = [], scale = 1, basePriority = 20) {
  for (const projectile of projectiles ?? []) {
    if ((projectile.lifetime ?? 1) <= 0) continue;
    const profile = projectileLightProfile(projectile);
    if (!profile) continue;
    lights.push({
      x: projectile.x,
      y: projectile.y,
      radius: profile.radius,
      intensity: profile.intensity * scale,
      color: profile.color,
      priority: basePriority + profile.priority,
    });
  }
}

function projectileLightProfile(projectile) {
  if (projectile.behavior === 'beam') {
    return { radius: Math.max(CELL_SIZE * 6, (projectile.radius ?? 2) * CELL_SIZE * 0.9), intensity: 0.22, color: projectile.color ?? '#ffe36a', priority: 18 };
  }
  const weapon = String(projectile.weapon ?? '');
  const radius = projectile.radius ?? 1;
  if (/mortar|rocket|sta|blast|explosion/i.test(weapon)) {
    return { radius: Math.max(CELL_SIZE * 5, radius * 7), intensity: 0.26, color: projectile.color ?? '#ff9b42', priority: 14 };
  }
  if (/orb|blade|flechette/i.test(weapon)) {
    return { radius: Math.max(CELL_SIZE * 3, radius * 5), intensity: 0.12, color: projectile.color ?? '#9be5ff', priority: 4 };
  }
  if ((projectile.damage ?? 0) >= 20) {
    return { radius: Math.max(CELL_SIZE * 3, radius * 5), intensity: 0.1, color: projectile.color ?? '#f7c06a', priority: 2 };
  }
  return null;
}

function lightScore(light, camera) {
  const priority = light.priority ?? 1;
  if (!camera) return priority;
  const distance = Math.hypot(light.x - camera.x, light.y - camera.y);
  return priority - distance * 0.006;
}
