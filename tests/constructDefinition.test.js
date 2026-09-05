import test from 'node:test';
import assert from 'node:assert/strict';
import basicTurretDefinition from '../content/constructs/basic_turret.json' with { type: 'json' };
import startingVehicleDefinition from '../content/constructs/starting_vehicle.json' with { type: 'json' };
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
  assert.equal(construct.cells.some((cell) => cell.type === 'gun' && cell.gridX === 0 && cell.gridY === -1), true);
});

test('starting vehicle content asset validates and instantiates runtime cells', () => {
  const report = validateConstructDefinition(startingVehicleDefinition);
  assert.equal(report.valid, true);

  const construct = instantiateConstruct(startingVehicleDefinition);
  assert.equal(construct.assetId, 'starting_vehicle');
  assert.equal(construct.cells.length, 8);
  assert.equal(construct.connections.length, 7);
  assert.equal(construct.cells.some((cell) => cell.type === 'utility'), true);
  assert.deepEqual(construct.modules.find((module) => module.cellId === 'utility')?.slots, ['booster', 'scrap_magnet']);
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

test('construct presentation metadata is preserved without replacing cells', () => {
  const construct = instantiateConstruct({
    ...startingVehicleDefinition,
    presentation: {
      sprite: {
        assetId: 'sprite.construct.test_vehicle',
        path: 'assets/images/constructs/test_vehicle.png',
        displaySize: [96, 96],
        anchor: [0.5, 0.5],
        alignToHeading: true,
      },
    },
  });
  assert.equal(construct.presentation.sprite.assetId, 'sprite.construct.test_vehicle');
  assert.equal(construct.cells.length, startingVehicleDefinition.cells.length);
  assert.equal(construct.connections.length, startingVehicleDefinition.connections.length);
});

test('construct definitions support stacked gridZ cells and vertical connections', () => {
  const layered = {
    ...startingVehicleDefinition,
    cells: [
      { id: 'core', type: 'core', gridX: 0, gridY: 0, gridZ: 0 },
      { id: 'upper-gun', type: 'gun', gridX: 0, gridY: 0, gridZ: 1 },
    ],
    connections: [{ a: 'core', b: 'upper-gun', aSide: 'above', bSide: 'below' }],
  };
  const report = validateConstructDefinition(layered);
  assert.equal(report.valid, true);
  const construct = instantiateConstruct(layered);
  assert.equal(construct.cells.find((cell) => cell.id === 'upper-gun').gridZ, 1);
  assert.equal(construct.connections[0].aSide, 'above');
});

test('construct validation treats matching x and y on different z layers as separate positions', () => {
  const report = validateConstructDefinition({
    ...startingVehicleDefinition,
    cells: [
      { id: 'core', type: 'core', gridX: 0, gridY: 0 },
      { id: 'top-armor', type: 'armor', gridX: 0, gridY: 0, gridZ: 1 },
    ],
    connections: [{ a: 'core', b: 'top-armor', aSide: 'above', bSide: 'below' }],
  });
  assert.equal(report.valid, true);
});

test('construct definitions preserve pose rig groups joints poses and animations', () => {
  const definition = {
    ...startingVehicleDefinition,
    poseRig: {
      groups: [{ id: 'turret', selector: 'type:gun', pivot: [0, -6, 0] }],
      joints: [{ id: 'turret-hinge', group: 'turret', kind: 'hinge', axis: [0, 0, 1] }],
      poses: [
        { id: 'left', transforms: [{ target: 'group:turret', rotation: -0.5 }] },
        { id: 'right', transforms: [{ target: 'group:turret', rotation: 0.5 }] },
      ],
      animations: [
        {
          id: 'sweep',
          kind: 'poseCycle',
          driver: 'time',
          frequency: 1,
          keyframes: [
            { at: 0, pose: 'left' },
            { at: 0.5, pose: 'right' },
          ],
        },
      ],
    },
  };
  const report = validateConstructDefinition(definition);
  assert.equal(report.valid, true);
  const construct = instantiateConstruct(definition);
  assert.equal(construct.poseRig.groups[0].id, 'turret');
  assert.equal(construct.poseRig.animations[0].kind, 'poseCycle');
});

test('construct pose rig aliases preserve weighted bindings dynamics and import metadata', () => {
  const definition = {
    ...startingVehicleDefinition,
    cellGroups: [{ id: 'gunGroup', selector: 'type:gun' }],
    joints: [{ id: 'gunJoint', group: 'gunGroup' }],
    cellBindings: { gun: [{ joint: 'gunJoint', weight: 2 }] },
    poseDynamics: { enabled: false, iterations: 2 },
    poseRigImports: [{ source: 'blockbench', mode: 'rigidHierarchy', assetId: 'creator.walker.blockbench' }],
  };
  const report = validateConstructDefinition(definition);
  assert.equal(report.valid, true);
  const construct = instantiateConstruct(definition);
  assert.deepEqual(construct.poseRig.cellBindings.gun, [{ joint: 'gunJoint', weight: 1 }]);
  assert.equal(construct.poseRig.dynamics.iterations, 2);
  assert.equal(construct.poseRig.imports[0].source, 'blockbench');
});

test('construct validation rejects invalid pose rig import metadata', () => {
  const report = validateConstructDefinition({
    ...startingVehicleDefinition,
    poseRig: {
      imports: [{ source: '', mode: 7 }],
    },
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('imports[0].source')), true);
  assert.equal(report.errors.some((error) => error.includes('imports[0].mode')), true);
});

test('construct validation rejects pose rigs that reference unknown groups or cells', () => {
  const report = validateConstructDefinition({
    ...startingVehicleDefinition,
    cellGroups: [{ id: 'missing-cell-group', cells: ['nope'] }],
    poseAnimations: [{ id: 'bad-aim', kind: 'aimAtTarget', target: 'group:missing' }],
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('unknown cell "nope"')), true);
  assert.equal(report.errors.some((error) => error.includes('unknown group "missing"')), true);
});

test('construct validation reports invalid weighted cell bindings clearly', () => {
  const report = validateConstructDefinition({
    ...startingVehicleDefinition,
    poseRig: {
      groups: [{ id: 'gunGroup', selector: 'type:gun' }],
      joints: [{ id: 'gunJoint', group: 'gunGroup' }],
      cellBindings: {
        gun: [
          { joint: 'gunJoint', weight: 0.5 },
          { joint: 'gunJoint', weight: 0.5 },
          { joint: 'missingJoint', weight: -1 },
        ],
      },
    },
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('maximum is 2')), true);
  assert.equal(report.errors.some((error) => error.includes('duplicated')), true);
  assert.equal(report.errors.some((error) => error.includes('unknown joint "missingJoint"')), true);
  assert.equal(report.errors.some((error) => error.includes('finite positive number')), true);
});
