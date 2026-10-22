import { CELL_LAYER_HEIGHT } from './voxelMask.js';
// Shared by damage resolution and movement, so phase protection starts in the
// same damage step that crosses a cell-loss threshold.
export function updateDiverDamageState(enemy, dt = 0) {
  const state = enemy.diver;
  if (!state || enemy.destroyed) return;
  if (state.theme === 'walker') {
    state.thrusterActive = !enemy.cells.some(c => c.role === 'diverLeg' && !c.state.destroyed);
    const lowest = Math.min(...enemy.cells.filter(c => !c.state.destroyed).map(c => c.gridZ ?? 0));
    if (Number.isFinite(lowest) && enemy.elevation) enemy.elevation.z = lowest * CELL_LAYER_HEIGHT;
  }
  if (state.theme !== 'ghost') return;
  const lost = state.initialCells - enemy.cells.filter(c => !c.state.destroyed).length;
  const threshold = Math.min(3, Math.floor(lost * 4 / state.initialCells));
  state.ghostPending += Math.max(0, threshold - state.ghostThreshold);
  state.ghostThreshold = Math.max(state.ghostThreshold, threshold);
  state.ghostTimer = Math.max(0, state.ghostTimer - dt);
  if (state.ghostTimer === 0 && state.ghostPending > 0) {
    state.ghostPending--;
    state.ghostTimer = 1;
  }
  enemy.phasedOut = state.ghostTimer > 0;
  enemy.renderAlpha = enemy.phasedOut ? 0.12 : 1;
}
