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
