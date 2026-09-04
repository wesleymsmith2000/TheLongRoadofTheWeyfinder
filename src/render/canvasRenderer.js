import { CELL_SIZE, VOXELS, Roles } from '../core/voxelMask.js';
import { cameraViewScale } from '../core/camera.js';
import { drawDebugOverlay } from '../debug/debugOverlay.js';
import { createTerrainAtlasLibrary } from './terrainAtlas.js';
import { TerrainRenderer } from './terrainRenderer.js';
import trackingFlechetteUrl from '../../assets/images/weapons/tracking_flechette.png';
import orbFlechetteUrl from '../../assets/images/weapons/orb_flechette.png';
import orbBladeShardUrl from '../../assets/images/weapons/orb_blade_shard.png';
import orbOfBladesCoreUrl from '../../assets/images/weapons/orb_of_blades_core.png';
import mortarPlayerShellUrl from '../../assets/images/weapons/mortar_player_shell.png';
import mortarEnemyShellUrl from '../../assets/images/weapons/mortar_enemy_shell.png';
import mortarPlayerMarkerUrl from '../../assets/images/weapons/mortar_player_marker.png';
import mortarEnemyMarkerUrl from '../../assets/images/weapons/mortar_enemy_marker.png';

const COLORS = {
  core: '#e4d66b',
  armor: '#8fa6ad',
  gun: '#d46e4f',
  utility: '#70c8ff',
  wheel: '#5fa66f',
  engine: '#b879d3',
  shadow: 'rgb(0 0 0 / 0.28)',
};

const BOSS_COLORS = {
  core: '#8b0000',
  armor: '#08080a',
  gun: '#ff7a1a',
  utility: '#70c8ff',
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

const CANON_IMAGE_URLS = new Map([
  ['sprite.weapon.tracking_flechette', trackingFlechetteUrl],
  ['sprite.weapon.orb_flechette', orbFlechetteUrl],
  ['sprite.weapon.orb_blade_shard', orbBladeShardUrl],
  ['sprite.weapon.orb_of_blades_core', orbOfBladesCoreUrl],
  ['sprite.weapon.mortar_player_shell', mortarPlayerShellUrl],
  ['sprite.weapon.mortar_enemy_shell', mortarEnemyShellUrl],
  ['sprite.weapon.mortar_player_marker', mortarPlayerMarkerUrl],
  ['sprite.weapon.mortar_enemy_marker', mortarEnemyMarkerUrl],
]);

export function createImageAssetLibrary(imageFactory = null) {
  const images = new Map();
  return {
    get(descriptor) {
      const source = resolveSpriteSource(descriptor);
      if (!source) return null;
      if (!images.has(source)) {
        const ImageCtor = imageFactory ?? globalThis.Image;
        if (!ImageCtor) return null;
        const image = new ImageCtor();
        image.src = source;
        images.set(source, image);
      }
      return images.get(source);
    },
  };
}

export function resolveSpriteSource(descriptor) {
  if (!descriptor) return null;
  const mapped = CANON_IMAGE_URLS.get(descriptor.assetId);
  if (mapped) return mapped;
  const source = descriptor.path ?? descriptor.uri;
  if (!source) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(source) || source.startsWith('data:')) return source;
  return `${baseUrl()}${source.replace(/^\/+/, '')}`;
}

function baseUrl() {
  const base = import.meta.env?.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrainRenderer = new TerrainRenderer(createTerrainAtlasLibrary());
    this.imageAssets = createImageAssetLibrary();
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
    const viewScale = cameraViewScale({ width: w, height: h });
    this.terrainRenderer.drawWorld(ctx, game.terrain, game.camera, w / viewScale, h / viewScale, debug);
    drawRoadLane(ctx, game.road);
    drawIncomingMarkers(ctx, game.incomingMarkers, game.time);
    drawScrapPickups(ctx, game.scrapPickups);
    for (const enemy of game.enemies) drawEnemy(ctx, enemy, game.time);
    drawSmokeParticles(ctx, game.smokeParticles);
    drawProjectiles(ctx, game.enemyProjectiles, '#ffb25f', this.imageAssets);
    drawProjectiles(ctx, game.playerProjectiles, '#9be5ff', this.imageAssets);
    drawVehicle(ctx, game.vehicle, game.boost, game.time, this.imageAssets);
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
  ctx.strokeStyle = reticle.source === 'ai' ? '#6fe08c' : '#83f7ff';
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
  const scale = cameraViewScale({ width: w, height: h });
  ctx.translate(w / 2, h * 0.58);
  ctx.scale(scale, scale);
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

function drawVehicle(ctx, vehicle, boost, time, imageAssets) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.heading);
  drawBoostShield(ctx, boost, time);
  drawConstructPresentation(ctx, vehicle, imageAssets);
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
  const gap = unit <= 1.25 ? 0 : Math.min(0.5, unit * 0.11);
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
      const width = Math.max(1, unit - gap * 2);
      ctx.fillStyle = shade(base, ROLE_SHADE[voxel.role] ?? 0);
      ctx.fillRect(px + gap, py + gap - lift, width, width);
      ctx.fillStyle = shade(base, -36);
      ctx.fillRect(px + gap, py + unit - gap * 2 - lift, width, Math.max(1, depth * 0.65));
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
  ctx.globalAlpha *= enemy.renderAlpha ?? 1;
  if ((enemy.elevation?.z ?? 0) > 0) drawEnemyElevationShadow(ctx, enemy);
  ctx.translate(0, -(enemy.elevation?.z ?? 0));
  if (enemy.kind === 'boss') {
    drawBossLaserTelegraphs(ctx, enemy, time);
    drawBossTentacleWiggle(ctx, enemy, time);
  } else {
    ctx.rotate(enemyRenderRotation(enemy, time));
  }
  const visualScale = enemy.visualScale ?? 1;
  if (visualScale !== 1) ctx.scale(visualScale, visualScale);
  drawEnemyPresentationUnderlay(ctx, enemy, time);
  const palette = enemy.kind === 'boss' ? BOSS_COLORS : enemy.palette ?? COLORS;
  for (const cell of enemy.cells) {
    if (!cell.state.destroyed) {
      const position = bossCellVisualPosition(enemy, cell, time);
      drawCell(ctx, cell, position.x, position.y, enemy.destroyed ? 0.35 : 1, palette);
    }
  }
  drawEnemyPresentationOverlay(ctx, enemy, palette, time);
  drawPirateShipFlair(ctx, enemy, palette, time);
  drawDizzySwirl(ctx, enemy, time);
  if (enemy.destroyed) {
    drawEnemyExplosion(ctx, enemy, time);
  } else if (enemy.kind === 'boss') {
    ctx.strokeStyle = '#ff5a2c';
    ctx.lineWidth = 2;
    drawBossOutline(ctx, enemy, time);
  }
  ctx.restore();
}

function drawConstructPresentation(ctx, construct, imageAssets) {
  const sprite = construct.presentation?.sprite;
  if (!sprite) return false;
  return drawSpriteDescriptor(ctx, imageAssets, sprite, 0, 0, 0);
}

function drawEnemyPresentationUnderlay(ctx, enemy, time) {
  const presentation = enemy.presentation;
  if (!presentation) return;
  if (presentation.variant === 'spiderWalker') drawWalkerLegStride(ctx, enemy, time, enemy.palette ?? COLORS);
  if (presentation.variant === 'scrapBuzzard') drawBuzzardWingBeat(ctx, enemy, time, enemy.palette ?? COLORS);
  if (presentation.variant === 'inchwormCarrier') drawInchwormSegmentWave(ctx, enemy, time, enemy.palette ?? COLORS);
}

function drawEnemyPresentationOverlay(ctx, enemy, palette, time) {
  const variant = enemy.presentation?.variant;
  if (!variant || enemy.destroyed) return;
  if (variant === 'ghostWraith') drawPulsingEyeGuns(ctx, [-CELL_SIZE * 0.42, CELL_SIZE * 0.42], -CELL_SIZE * 0.55, time, '#ff233a', 1.35);
  if (variant === 'tractorFrog') {
    drawFrogHopSquash(ctx, enemy, time, palette);
    drawPulsingEyeGuns(ctx, [-CELL_SIZE * 0.58, CELL_SIZE * 0.58], -CELL_SIZE * 0.68, time, '#ff2638', 1.15);
  }
  if (variant === 'heavyMortarBoat') drawMortarBoatDeckGun(ctx, time, palette);
  if (variant === 'mothBomber') drawMothFlicker(ctx, time, palette);
}

function drawPulsingEyeGuns(ctx, xs, y, time, color, scale = 1) {
  const pulse = Math.sin(time * 9) * 0.5 + 0.5;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 + pulse * 10;
  for (const x of xs) {
    ctx.fillStyle = '#35050a';
    ctx.beginPath();
    ctx.arc(x, y, CELL_SIZE * 0.17 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, CELL_SIZE * (0.08 + pulse * 0.045) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWalkerLegStride(ctx, enemy, time, palette) {
  const speed = Math.hypot(enemy.vx ?? 0, enemy.vy ?? 0);
  const stride = time * (3.8 + speed * 0.025);
  const legColor = palette.leg ?? '#a7c8ff';
  ctx.save();
  ctx.strokeStyle = legColor;
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 4; index += 1) {
      const y = (-1.15 + index * 0.76) * CELL_SIZE;
      const phase = stride + index * Math.PI + (side < 0 ? 0 : Math.PI * 0.72);
      const lift = Math.sin(phase) * CELL_SIZE * 0.16;
      const reach = CELL_SIZE * (1.15 + Math.cos(phase) * 0.22);
      const hip = { x: side * CELL_SIZE * 0.55, y };
      const knee = { x: side * reach, y: y + lift };
      const foot = { x: side * CELL_SIZE * (1.75 + Math.cos(phase + 0.8) * 0.16), y: y + CELL_SIZE * 0.36 - lift };
      ctx.beginPath();
      ctx.moveTo(hip.x, hip.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.lineTo(foot.x, foot.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFrogHopSquash(ctx, enemy, time, palette) {
  const hop = Math.max(0, Math.sin((enemy.hopTimer ?? time) * Math.PI * 2));
  ctx.save();
  ctx.globalAlpha *= 0.28 + hop * 0.2;
  ctx.strokeStyle = palette.accent ?? '#f26cff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, CELL_SIZE * 0.92, CELL_SIZE * (1.15 + hop * 0.4), CELL_SIZE * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMortarBoatDeckGun(ctx, time, palette) {
  const recoil = Math.max(0, Math.sin(time * 11)) * CELL_SIZE * 0.08;
  ctx.save();
  ctx.translate(0, -CELL_SIZE * 0.55 + recoil);
  ctx.fillStyle = '#101318';
  ctx.strokeStyle = palette.gun ?? '#ff7a1a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-CELL_SIZE * 0.3, -CELL_SIZE * 1.25, CELL_SIZE * 0.6, CELL_SIZE * 1.55, CELL_SIZE * 0.12);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -CELL_SIZE * 1.28, CELL_SIZE * 0.38, CELL_SIZE * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBuzzardWingBeat(ctx, enemy, time, palette) {
  const speed = Math.hypot(enemy.vx ?? 0, enemy.vy ?? 0);
  const flap = Math.sin(time * (5 + speed * 0.01));
  ctx.save();
  ctx.strokeStyle = palette.wing ?? '#d6cfb9';
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-CELL_SIZE * 0.4, -CELL_SIZE * 0.1);
  ctx.quadraticCurveTo(-CELL_SIZE * 1.9, -CELL_SIZE * (0.75 + flap * 0.22), -CELL_SIZE * 2.8, -CELL_SIZE * (0.1 - flap * 0.2));
  ctx.moveTo(CELL_SIZE * 0.4, -CELL_SIZE * 0.1);
  ctx.quadraticCurveTo(CELL_SIZE * 1.9, -CELL_SIZE * (0.75 - flap * 0.22), CELL_SIZE * 2.8, -CELL_SIZE * (0.1 + flap * 0.2));
  ctx.stroke();
  ctx.restore();
}

function drawInchwormSegmentWave(ctx, enemy, time, palette) {
  ctx.save();
  ctx.globalAlpha *= 0.36;
  ctx.fillStyle = palette.core ?? '#d7ff9b';
  for (let index = 0; index < 6; index += 1) {
    const x = (index - 2.75) * CELL_SIZE * 0.56;
    const y = Math.sin(time * 4.2 + index * 0.8) * CELL_SIZE * 0.16;
    ctx.beginPath();
    ctx.ellipse(x, y, CELL_SIZE * 0.32, CELL_SIZE * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMothFlicker(ctx, time, palette) {
  const flicker = Math.sin(time * 22) * 0.5 + 0.5;
  ctx.save();
  ctx.globalAlpha *= 0.38 + flicker * 0.24;
  ctx.strokeStyle = palette.gun ?? '#ff7a1a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, CELL_SIZE * (0.55 + flicker * 0.18), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawEnemyElevationShadow(ctx, enemy) {
  const z = enemy.elevation?.z ?? 0;
  const alpha = Math.max(0.08, 0.24 - z / 900);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#050506';
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(CELL_SIZE * 1.1, enemy.radius * 0.65), Math.max(CELL_SIZE * 0.35, enemy.radius * 0.22), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function enemyRenderRotation(enemy, time) {
  if (Number.isFinite(enemy.collisionRotation)) return enemy.collisionRotation;
  if (enemy.silhouette !== 'pirateShip') return 0;
  let heading = enemy.visualHeading ?? Math.PI / 2;
  const firedAge = enemy.lastFiredAt == null ? Infinity : time - enemy.lastFiredAt;
  if (firedAge >= 0 && firedAge < 0.85 && Number.isFinite(enemy.attackHeading)) {
    heading = closestBroadsideHeading(heading, enemy.attackHeading);
  }
  return heading - Math.PI / 2;
}

function closestBroadsideHeading(current, attackHeading) {
  const left = attackHeading + Math.PI / 2;
  const right = attackHeading - Math.PI / 2;
  return Math.abs(angleDelta(current, left)) <= Math.abs(angleDelta(current, right)) ? left : right;
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function drawPirateShipFlair(ctx, enemy, palette, time) {
  if (enemy.silhouette !== 'pirateShip' || enemy.destroyed) return;
  ctx.save();
  ctx.strokeStyle = shade(palette.armor ?? COLORS.armor, -44);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-CELL_SIZE * 0.65, CELL_SIZE * 2.18);
  ctx.lineTo(0, CELL_SIZE * 2.85);
  ctx.lineTo(CELL_SIZE * 0.65, CELL_SIZE * 2.18);
  ctx.stroke();
  ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
  ctx.fillRect(-CELL_SIZE * 1.45, -CELL_SIZE * 0.25, CELL_SIZE * 2.9, CELL_SIZE * 0.5);
  if (enemy.ramBulkhead) drawRamBulkhead(ctx, palette, time);
  ctx.restore();
}

function drawDizzySwirl(ctx, enemy, time) {
  if ((enemy.dizzyTimer ?? 0) <= 0 || enemy.destroyed) return;
  const pulse = Math.sin(time * 8) * 0.5 + 0.5;
  ctx.save();
  ctx.translate(0, -enemy.radius * 0.74);
  ctx.strokeStyle = `rgb(255 241 168 / ${0.55 + pulse * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let index = 0; index < 28; index += 1) {
    const t = index / 27;
    const angle = time * 5.2 + (enemy.dizzyPhase ?? 0) + t * Math.PI * 2.5;
    const radius = CELL_SIZE * (0.18 + t * 0.78);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.38;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let index = 0; index < 3; index += 1) {
    const angle = time * 4.2 + (enemy.dizzyPhase ?? 0) + (index * Math.PI * 2) / 3;
    const x = Math.cos(angle) * CELL_SIZE * 0.9;
    const y = Math.sin(angle) * CELL_SIZE * 0.34;
    drawStar(ctx, x, y, CELL_SIZE * (0.16 + pulse * 0.05), '#fff1a8');
  }
  ctx.restore();
}

function drawStar(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const pointRadius = index % 2 === 0 ? radius : radius * 0.42;
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 10;
    const px = Math.cos(angle) * pointRadius;
    const py = Math.sin(angle) * pointRadius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRamBulkhead(ctx, palette, time) {
  const shimmer = Math.sin(time * 12) * 0.5 + 0.5;
  const y = CELL_SIZE * 3.05;
  ctx.fillStyle = shade(palette.armor ?? COLORS.armor, -56);
  ctx.strokeStyle = palette.gun ?? COLORS.gun;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, y, CELL_SIZE * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4eee4';
  ctx.beginPath();
  ctx.arc(-CELL_SIZE * 0.23, y - CELL_SIZE * 0.1, CELL_SIZE * 0.1 + shimmer * 0.04, 0, Math.PI * 2);
  ctx.arc(CELL_SIZE * 0.23, y - CELL_SIZE * 0.1, CELL_SIZE * 0.1 + shimmer * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.gun ?? COLORS.gun;
  for (const x of [-1.25, -0.82, 0.82, 1.25]) {
    ctx.beginPath();
    ctx.moveTo(x * CELL_SIZE, y - CELL_SIZE * 0.28);
    ctx.lineTo(x * CELL_SIZE, y + CELL_SIZE * 0.72);
    ctx.stroke();
  }
}

function drawBossLaserTelegraphs(ctx, enemy, time) {
  if (enemy.kind !== 'boss') return;
  for (const arm of enemy.arms ?? []) {
    if (!arm.laser?.target) continue;
    const progress = 1 - Math.max(0, arm.laser.timer / Math.max(0.001, arm.laser.duration));
    const lockProgress = Math.max(0, 1 - Math.max(0, arm.laser.timer) / 1);
    const locked = arm.laser.timer <= 1;
    const flashRate = locked ? 42 + lockProgress * 54 : 7;
    const flash = Math.sin(time * flashRate) * 0.5 + 0.5;
    const source = arm.laser.source ?? { x: enemy.x, y: enemy.y };
    ctx.save();
    ctx.globalAlpha = locked ? 0.18 + flash * 0.8 : 0.44 + progress * 0.16;
    ctx.strokeStyle = '#ff2626';
    ctx.lineWidth = locked ? 1.7 + flash * 3.3 : 1.2 + progress * 1.1;
    ctx.setLineDash(locked ? [] : [CELL_SIZE * 0.7, CELL_SIZE * 0.46]);
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

function drawProjectiles(ctx, projectiles, color, imageAssets) {
  for (const projectile of projectiles) {
    if (projectile.behavior === 'beam') {
      drawBeam(ctx, projectile);
      continue;
    }
    if (projectile.behavior === 'blast') {
      drawBlast(ctx, projectile);
      continue;
    }
    if (projectile.behavior === 'arc') {
      drawArcProjectile(ctx, projectile, color, imageAssets);
      continue;
    }
    if (drawProjectileSprite(ctx, projectile, imageAssets)) continue;
    if (projectile.weapon === 'boss-missile') {
      drawBossMissile(ctx, projectile);
      continue;
    }
    if (projectile.weapon === 'orb_flechette') {
      drawOrbFlechette(ctx, projectile);
      continue;
    }
    if (projectile.shape?.kind === 'cylinderCone') {
      drawProjectileShell(ctx, projectile);
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

function drawOrbFlechette(ctx, projectile) {
  const teeth = 10;
  const outer = projectile.radius;
  const inner = outer * 0.58;
  const spin = (projectile.maxLifetime - projectile.lifetime) * 26 + projectile.angle;
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(spin);
  ctx.fillStyle = '#d7eef1';
  ctx.strokeStyle = '#5e7278';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let index = 0; index < teeth * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * 2 * index) / (teeth * 2);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#88a9b3';
  ctx.beginPath();
  ctx.arc(0, 0, outer * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArcProjectile(ctx, projectile, color, imageAssets) {
  const heightRatio = Math.max(0, Math.min(1, projectile.z / Math.max(1, projectile.maxArcHeight ?? 1)));
  const visualX = projectile.x;
  const visualY = projectile.y - projectile.z;
  const scale = 1 + heightRatio * 0.55;
  const marker = projectile.detonateAtTarget && projectile.targetHint ? projectile.targetHint : projectile;
  ctx.save();
  ctx.globalAlpha = 0.18 + (1 - heightRatio) * 0.26;
  ctx.fillStyle = '#050506';
  ctx.beginPath();
  ctx.ellipse(projectile.x, projectile.y, projectile.shadowRadius * (1 - heightRatio * 0.45), projectile.shadowRadius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawArcLandingMarker(ctx, projectile, marker, color, imageAssets);
  if (drawProjectileSprite(ctx, projectile, imageAssets, { x: visualX, y: visualY, scale })) {
    ctx.restore();
    return;
  }
  ctx.fillStyle = projectile.color ?? color;
  ctx.beginPath();
  ctx.arc(visualX, visualY, projectile.radius * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4fffb';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawArcLandingMarker(ctx, projectile, marker, color, imageAssets) {
  const progress = arcLandingProgress(projectile);
  const markerScale = 0.5 + easeOutCubic(progress) * 0.5;
  const markerAlpha = 0.5 + progress * 0.5;
  const enemyMarker = projectile.team === 'enemy';
  ctx.save();
  ctx.globalAlpha *= markerAlpha;
  if (!drawSpriteDescriptor(ctx, imageAssets, projectile.landingMarkerSprite, marker.x, marker.y, 0, markerScale)) {
    ctx.strokeStyle = enemyMarker ? '#ff5a54' : projectile.color ?? color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, Math.max(projectile.shadowRadius * 1.8, 8) * markerScale, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawArcMarkerCenter(ctx, projectile, marker, progress);
  ctx.restore();
}

function drawArcMarkerCenter(ctx, projectile, marker, progress) {
  const enemyMarker = projectile.team === 'enemy';
  ctx.save();
  ctx.translate(marker.x, marker.y);
  if (!enemyMarker) {
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const rate = 3 + progress * progress * 18;
  const pulse = Math.sin((projectile.arcAge ?? 0) * rate * Math.PI * 2) * 0.5 + 0.5;
  ctx.globalAlpha *= 0.58 + pulse * 0.42;
  ctx.strokeStyle = '#ffebe3';
  ctx.fillStyle = '#ffebe3';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.2 + pulse * 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -8 - pulse * 2);
  ctx.lineTo(0, -2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 4, 2.2 + pulse * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function arcLandingProgress(projectile) {
  if (projectile.arcLanded) return 1;
  return Math.max(0, Math.min(1, (projectile.arcAge ?? 0) / Math.max(0.001, projectile.arcFlightTime ?? projectile.maxLifetime ?? 1)));
}

function drawProjectileSprite(ctx, projectile, imageAssets, options = {}) {
  const sprite = options.sprite ?? projectile.sprite;
  const x = options.x ?? projectile.x;
  const y = options.y ?? projectile.y;
  const angle = sprite?.alignToVelocity ? projectile.angle : 0;
  return drawSpriteDescriptor(ctx, imageAssets, sprite, x, y, angle, options.scale ?? 1);
}

function drawSpriteDescriptor(ctx, imageAssets, sprite, x, y, angle = 0, scale = 1) {
  if (!sprite) return false;
  const image = imageAssets?.get(sprite);
  if (!imageReady(image)) return false;
  const size = sprite.displaySize ?? sprite.nativeSize ?? [16, 16];
  const anchor = sprite.anchor ?? [0.5, 0.5];
  const width = size[0] * scale;
  const height = size[1] * scale;
  ctx.save();
  ctx.globalAlpha *= sprite.opacity ?? 1;
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(image, -anchor[0] * width, -anchor[1] * height, width, height);
  ctx.restore();
  return true;
}

function imageReady(image) {
  return Boolean(image?.complete && image.naturalWidth > 0);
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

function drawProjectileShell(ctx, projectile) {
  const shape = projectile.shape;
  const bodyLength = shape.bodyLength ?? 12;
  const coneLength = shape.coneLength ?? 5;
  const halfWidth = shape.halfWidth ?? projectile.radius;
  const bodyStart = -bodyLength / 2;
  const bodyEnd = bodyLength / 2;
  const bodyColor = projectile.weapon === 'cannon' ? '#3a3d40' : '#8a8a86';
  const coneColor = projectile.weapon === 'cannon' ? '#fff1a8' : '#df6f2e';
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(projectile.angle);

  const bodyIntegrity = sectionIntegrity(projectile.hull, 'cylinder');
  const coneIntegrity = sectionIntegrity(projectile.hull, 'cone');
  ctx.fillStyle = shade(bodyColor, Math.round((bodyIntegrity - 1) * 74));
  ctx.strokeStyle = '#202222';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.rect(bodyStart, -halfWidth, bodyLength, halfWidth * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = shade(coneColor, Math.round((coneIntegrity - 1) * 74));
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
  const voxelWidth = baseVoxelWidth + widthEnvelope * 2.8;
  const endX = projectile.renderEndX ?? projectile.x + Math.cos(projectile.angle) * projectile.length;
  const endY = projectile.renderEndY ?? projectile.y + Math.sin(projectile.angle) * projectile.length;
  ctx.save();
  ctx.globalAlpha = (projectile.alpha ?? 1) * (0.35 + widthEnvelope * 0.65);
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
