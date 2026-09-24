const FORWARD_NEIGHBORS = Object.freeze([
  { dx: 1, dy: 0, dz: 0, side: 'right', opposite: 'left' },
  { dx: 0, dy: 1, dz: 0, side: 'bottom', opposite: 'top' },
  { dx: 0, dy: 0, dz: 1, side: 'above', opposite: 'below' },
]);

export function connectAllAdjacentCells(cells, existingConnections = []) {
  const byId = new Map((cells ?? []).map((cell) => [cell.id, cell]));
  const byPosition = new Map((cells ?? []).map((cell) => [positionKey(cell), cell]));
  const connections = [];
  const connectedPairs = new Set();

  for (const connection of existingConnections ?? []) {
    if (!byId.has(connection.a) || !byId.has(connection.b)) continue;
    const pair = pairKey(connection.a, connection.b);
    if (connectedPairs.has(pair)) continue;
    connectedPairs.add(pair);
    connections.push({ ...connection });
  }

  for (const cell of cells ?? []) {
    for (const neighbor of FORWARD_NEIGHBORS) {
      const adjacent = byPosition.get(positionKey({
        gridX: cell.gridX + neighbor.dx,
        gridY: cell.gridY + neighbor.dy,
        gridZ: layerOf(cell) + neighbor.dz,
      }));
      if (!adjacent) continue;
      const pair = pairKey(cell.id, adjacent.id);
      if (connectedPairs.has(pair)) continue;
      connectedPairs.add(pair);
      connections.push({
        a: cell.id,
        b: adjacent.id,
        aSide: neighbor.side,
        bSide: neighbor.opposite,
        type: 'structural',
      });
    }
  }
  return connections;
}

export function removeConnectionBetween(connections, firstCellId, secondCellId) {
  return (connections ?? []).filter((connection) => pairKey(connection.a, connection.b) !== pairKey(firstCellId, secondCellId));
}

function positionKey(cell) {
  return `${cell.gridX},${cell.gridY},${layerOf(cell)}`;
}

function layerOf(cell) {
  return Number.isInteger(cell?.gridZ) ? cell.gridZ : Number.isInteger(cell?.layer) ? cell.layer : 0;
}

function pairKey(first, second) {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}
