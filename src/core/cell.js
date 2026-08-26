import { createVoxelMask, summarizeMask } from './voxelMask.js';

export function createCell(id, type, gridX, gridY) {
  const cell = {
    id,
    type,
    gridX,
    gridY,
    layer: 0,
    rotation: 0,
    material: type === 'armor' ? 'plate' : 'scrap',
    mask: createVoxelMask(type),
    state: null,
    attached: true,
  };
  recalculateCell(cell);
  return cell;
}

export function recalculateCell(cell) {
  cell.state = summarizeMask(cell.mask);
  return cell.state;
}
