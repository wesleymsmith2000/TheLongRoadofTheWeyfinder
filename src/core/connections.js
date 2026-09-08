export const OPPOSITE = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
  above: 'below',
  below: 'above',
};

export function createConnection(a, b, aSide, bSide = OPPOSITE[aSide], type = 'structural') {
  return { a, b, aSide, bSide, type, valid: true };
}

export function updateConnectionValidity(connections, cellsById, threshold = 0.55) {
  for (const edge of connections) {
    const a = cellsById.get(edge.a);
    const b = cellsById.get(edge.b);
    edge.valid =
      Boolean(a && b) &&
      !a.state.destroyed &&
      !b.state.destroyed &&
      connectionIntegrity(a, edge.aSide) > threshold &&
      connectionIntegrity(b, edge.bSide) > threshold;
  }
}

function connectionIntegrity(cell, side) {
  return cell.state.anchorIntegrity[side] ?? cell.state.structureIntegrity;
}

export function connectedFromCore(cells, connections) {
  const roots = cells.filter((cell) => cell.type === 'core' && !cell.state.destroyed);
  if (roots.length === 0) return new Set();
  const connected = new Set(roots.map((cell) => cell.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of connections) {
      if (!edge.valid || edge.type !== 'structural') continue;
      const hasA = connected.has(edge.a);
      const hasB = connected.has(edge.b);
      if (hasA && !hasB) {
        connected.add(edge.b);
        changed = true;
      } else if (hasB && !hasA) {
        connected.add(edge.a);
        changed = true;
      }
    }
  }
  return connected;
}

export function coreDistanceMap(cells, connections, options = {}) {
  const includeDestroyed = options.includeDestroyed ?? true;
  const cellsById = new Map();
  for (const cell of cells ?? []) {
    if (!cell?.id) continue;
    if (!includeDestroyed && cell.state?.destroyed) continue;
    cellsById.set(cell.id, cell);
  }

  const distances = new Map();
  const queue = [];
  for (const cell of cellsById.values()) {
    if (cell.type !== 'core') continue;
    distances.set(cell.id, 0);
    queue.push(cell.id);
  }

  if (queue.length === 0) return distances;
  const neighborsById = new Map();
  for (const id of cellsById.keys()) neighborsById.set(id, []);
  for (const edge of connections ?? []) {
    if (!edge || edge.type !== 'structural') continue;
    if (edge.valid === false && !includeDestroyed) continue;
    if (!cellsById.has(edge.a) || !cellsById.has(edge.b)) continue;
    neighborsById.get(edge.a).push(edge.b);
    neighborsById.get(edge.b).push(edge.a);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    const nextDistance = distances.get(id) + 1;
    for (const neighbor of neighborsById.get(id) ?? []) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, nextDistance);
      queue.push(neighbor);
    }
  }

  return distances;
}
