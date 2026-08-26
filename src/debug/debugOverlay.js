export function createDebugOverlay() {
  return { visible: true };
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
    `last hit ${lastHit?.id ?? 'none'}`,
    lastHit ? `structure ${lastHit.state.structureIntegrity.toFixed(2)}` : '',
    lastHit ? `anchors ${Object.entries(lastHit.state.anchorIntegrity).map(([k, v]) => `${k[0]}:${v.toFixed(2)}`).join(' ')}` : '',
    lastHit ? `wiring ${lastHit.state.wiringIntegrity.toFixed(2)} device ${lastHit.state.deviceIntegrity.toFixed(2)}` : '',
    `connected ${vehicle.cells.filter((cell) => cell.attached && !cell.state.destroyed).length}`,
    `detached ${vehicle.detachedPieces.length + vehicle.cells.filter((cell) => !cell.attached).length}`,
    `autofire ${game.autofire ? 'on' : 'off'}`,
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
