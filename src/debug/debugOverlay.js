export function createDebugOverlay() {
  return { visible: false };
}

export function drawDebugOverlay(ctx, game) {
  const vehicle = game.vehicle;
  const lastHit = vehicle.cells.find((cell) => cell.id === vehicle.lastHitCellId);
  const lines = [
    `FPS ${game.fps.toFixed(0)}`,
    `mass ${vehicle.totalMass.toFixed(1)}`,
    `COM ${vehicle.centerOfMass.x.toFixed(1)}, ${vehicle.centerOfMass.y.toFixed(1)}`,
    `inertia ${vehicle.momentOfInertia.toFixed(0)}`,
    `speed ${Math.hypot(vehicle.vx, vehicle.vy).toFixed(1)}`,
    `angular ${vehicle.angularVelocity.toFixed(2)}`,
    `turret ${vehicle.turretHeading.toFixed(2)}`,
    `road ${game.road.x.toFixed(0)}, ${game.road.y.toFixed(0)} ${game.road.speed.toFixed(0)}`,
    `lane ${game.road.halfWidth.toFixed(0)} x ${game.road.halfHeight.toFixed(0)}`,
    `camera ${game.camera.x.toFixed(0)}, ${game.camera.y.toFixed(0)} ${game.camera.heading.toFixed(2)}`,
    game.terrainSample
      ? `terrain ${game.terrainSample.materialId} t:${game.terrainSample.traction.toFixed(2)} c:${game.terrainSample.chunkX},${game.terrainSample.chunkY}`
      : '',
    game.terrain ? `terrain chunks ${game.terrain.chunks.size} gen ${game.terrain.stats.generatedChunks} retired ${game.terrain.stats.retiredChunks}` : '',
    `last hit ${lastHit?.id ?? 'none'}`,
    lastHit ? `structure ${lastHit.state.structureIntegrity.toFixed(2)}` : '',
    lastHit ? `anchors ${Object.entries(lastHit.state.anchorIntegrity).map(([k, v]) => `${k[0]}:${v.toFixed(2)}`).join(' ')}` : '',
    lastHit ? `wiring ${lastHit.state.wiringIntegrity.toFixed(2)} device ${lastHit.state.deviceIntegrity.toFixed(2)}` : '',
    `connected ${vehicle.cells.filter((cell) => cell.attached && !cell.state.destroyed).length}`,
    `detached ${vehicle.detachedPieces.length + vehicle.cells.filter((cell) => !cell.attached).length}`,
    `autofire ${game.autofire ? 'on' : 'off'}`,
    `secondary ${game.secondary.selected} ${game.secondary.ammo[game.secondary.selected] ?? '-'} heat ${game.secondary.heat.toFixed(0)}`,
    game.music ? `music ${game.music.semanticState} t:${formatLayer(game.music.layerVolumes?.travel)} a:${formatLayer(game.music.layerVolumes?.attention)} s:${formatLayer(game.music.layerVolumes?.suspicion)} m:${formatLayer(game.music.layerVolumes?.manifestation)}` : '',
    `damage ${game.score.damageDone}`,
    `level ${game.level} enemies ${game.enemies.filter((enemy) => !enemy.destroyed).length}`,
    ...performanceLines(game.performance),
  ].filter(Boolean);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '13px ui-monospace, SFMono-Regular, Consolas, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgb(8 9 9 / 0.68)';
  ctx.fillRect(14, 92, 272, lines.length * 18 + 16);
  ctx.fillStyle = '#e9f2df';
  lines.forEach((line, index) => ctx.fillText(line, 24, 102 + index * 18));
  ctx.restore();
}

function performanceLines(performance) {
  if (!performance?.sampleCount) return [];
  const frame = performance.frame;
  const rafGap = performance.rafGap ?? frame;
  const slices = performance.slices ?? {};
  const counters = performance.counters ?? {};
  const slow = performance.slowFrames ?? {};
  return [
    `perf samples ${performance.sampleCount}/${performance.windowSize}`,
    `raf avg ${formatMs(rafGap.avg)} p95 ${formatMs(rafGap.p95)} max ${formatMs(rafGap.max)}`,
    `js avg ${formatMs(frame.avg)} p95 ${formatMs(frame.p95)} max ${formatMs(frame.max)}`,
    `sim ${formatMs(slices.simulation?.avg)} ui ${formatMs(slices.ui?.avg)} render ${formatMs(slices.render?.avg)}`,
    `slow >33 ${slow.over33ms ?? 0} >50 ${slow.over50ms ?? 0} >100 ${slow.over100ms ?? 0}`,
    `proj p/e ${counters.playerProjectiles ?? 0}/${counters.enemyProjectiles ?? 0} smoke ${counters.smokeParticles ?? 0}`,
    `audio play ${counters.audioPlayCalls ?? 0} enemy sfx ${counters.enemyBulletSoundEvents ?? 0}`,
    `cells enemy ${counters.liveEnemyCells ?? 0}/${counters.enemyCells ?? 0} vehicle ${counters.vehicleCells ?? 0}`,
    `terrain cache ${counters.terrainCacheBuilds ?? 0} pending ${counters.terrainPendingChunks ?? 0}`,
  ];
}

function formatMs(value = 0) {
  return `${value.toFixed(1)}ms`;
}

function formatLayer(value = 0) {
  return value.toFixed(2);
}
