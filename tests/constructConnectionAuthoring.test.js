import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAllAdjacentCells, removeConnectionBetween } from '../src/editor/constructConnectionAuthoring.js';

test('auto-connect links every orthogonally adjacent cell across layers', () => {
  const cells = [
    { id: 'core', gridX: 0, gridY: 0, gridZ: 0 },
    { id: 'right', gridX: 1, gridY: 0, gridZ: 0 },
    { id: 'below', gridX: 0, gridY: 1, gridZ: 0 },
    { id: 'above', gridX: 0, gridY: 0, gridZ: 1 },
    { id: 'diagonal', gridX: 1, gridY: 1, gridZ: 1 },
  ];
  const connections = connectAllAdjacentCells(cells);

  assert.equal(connections.length, 3);
  assert.equal(connections.some((edge) => edge.a === 'core' && edge.b === 'above' && edge.aSide === 'above'), true);
  assert.equal(connections.some((edge) => edge.a === 'core' && edge.b === 'right' && edge.aSide === 'right'), true);
  assert.equal(connections.some((edge) => edge.a === 'core' && edge.b === 'below' && edge.aSide === 'bottom'), true);
});

test('auto-connect preserves valid custom edges and removes duplicates or stale endpoints', () => {
  const cells = [
    { id: 'a', gridX: 0, gridY: 0 },
    { id: 'b', gridX: 1, gridY: 0 },
  ];
  const existing = [
    { a: 'b', b: 'a', aSide: 'left', bSide: 'right', type: 'custom' },
    { a: 'a', b: 'b', aSide: 'right', bSide: 'left', type: 'structural' },
    { a: 'a', b: 'missing', type: 'structural' },
  ];
  const connections = connectAllAdjacentCells(cells, existing);

  assert.deepEqual(connections, [existing[0]]);
});

test('remove connection deletes the selected pair in either direction', () => {
  const connections = [
    { a: 'a', b: 'b' },
    { a: 'b', b: 'c' },
  ];

  assert.deepEqual(removeConnectionBetween(connections, 'b', 'a'), [{ a: 'b', b: 'c' }]);
});
