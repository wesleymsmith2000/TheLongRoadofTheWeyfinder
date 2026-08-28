import test from 'node:test';
import assert from 'node:assert/strict';
import basicTurretDefinition from '../content/constructs/basic_turret.json' with { type: 'json' };
import { instantiateConstruct, validateConstructDefinition } from '../src/core/constructDefinition.js';

test('basic turret content asset validates and instantiates runtime cells', () => {
  const report = validateConstructDefinition(basicTurretDefinition);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);

  const construct = instantiateConstruct(basicTurretDefinition);
  assert.equal(construct.assetId, 'basic_turret');
  assert.equal(construct.cells.length, 9);
  assert.equal(construct.connections.length, 8);
  assert.equal(construct.cells.some((cell) => cell.type === 'core'), true);
});

test('construct validation rejects incompatible schema versions', () => {
  const report = validateConstructDefinition({
    ...basicTurretDefinition,
    schemaVersion: '1.0',
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('Unsupported construct schemaVersion')), true);
});

test('construct validation rejects unknown connection endpoints', () => {
  const report = validateConstructDefinition({
    ...basicTurretDefinition,
    connections: [{ a: 'core', b: 'missing-cell', aSide: 'top' }],
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('unknown cell')), true);
});

test('construct validation warns instead of forbidding disconnected legal designs', () => {
  const report = validateConstructDefinition({
    ...basicTurretDefinition,
    connections: [],
  });
  assert.equal(report.valid, true);
  assert.equal(report.warnings.some((warning) => warning.includes('no explicit connections')), true);
});
