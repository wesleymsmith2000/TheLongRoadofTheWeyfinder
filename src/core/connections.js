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
  const core = cells.find((cell) => cell.type === 'core' && !cell.state.destroyed);
  if (!core) return new Set();
  const connected = new Set([core.id]);
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
