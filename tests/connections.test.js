import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { updateConnectionValidity, connectedFromCore } from '../src/core/connections.js';

test('structural connectivity starts from explicit graph edges, not implicit grid adjacency', () => {
  const vehicle = createStartingVehicle();
  vehicle.connections = vehicle.connections.filter((edge) => edge.a !== 'core' || edge.b !== 'gun');
  const cellsById = new Map(vehicle.cells.map((cell) => [cell.id, cell]));
  updateConnectionValidity(vehicle.connections, cellsById);
  const connected = connectedFromCore(vehicle.cells, vehicle.connections);
  assert.equal(connected.has('core'), true);
  assert.equal(connected.has('gun'), false);
});

test('structural connectivity roots from every surviving core cell', () => {
  const vehicle = createStartingVehicle({
    schemaVersion: '0.1',
    assetId: 'test.multi_core_vehicle',
    cells: [
      { id: 'core-a', type: 'core', gridX: 0, gridY: 0 },
      { id: 'core-b', type: 'core', gridX: 1, gridY: 0 },
      { id: 'left-gun', type: 'gun', gridX: -1, gridY: 0 },
      { id: 'right-gun', type: 'gun', gridX: 2, gridY: 0 },
    ],
    connections: [
      { a: 'core-a', b: 'core-b', aSide: 'right', bSide: 'left' },
      { a: 'core-a', b: 'left-gun', aSide: 'left', bSide: 'right' },
      { a: 'core-b', b: 'right-gun', aSide: 'right', bSide: 'left' },
    ],
  });
  const coreA = vehicle.cells.find((cell) => cell.id === 'core-a');
  coreA.state.destroyed = true;
  const cellsById = new Map(vehicle.cells.map((cell) => [cell.id, cell]));
  updateConnectionValidity(vehicle.connections, cellsById);
  const connected = connectedFromCore(vehicle.cells, vehicle.connections);

  assert.equal(connected.has('core-a'), false);
  assert.equal(connected.has('core-b'), true);
  assert.equal(connected.has('right-gun'), true);
  assert.equal(connected.has('left-gun'), false);
});
