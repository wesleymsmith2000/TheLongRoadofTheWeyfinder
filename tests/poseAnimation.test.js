import test from 'node:test';
import assert from 'node:assert/strict';
import { createCell } from '../src/core/cell.js';
import { applyCellPoseTransform, createWalkerStridePoseRig, evaluatePoseRig } from '../src/core/poseAnimation.js';
import { deriveRigidCellBindings, normalizeCellWeights } from '../src/core/poseWeights.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('pose rig oscillation moves every cell in a linked group together', () => {
  const left = createCell('left-foot', 'wheel', -1, 1);
  const right = createCell('right-foot', 'wheel', 1, 1);
  const entity = {
    x: 0,
    y: 0,
    cells: [left, right],
    poseRig: {
      groups: [{ id: 'feet', selector: 'type:wheel' }],
      animations: [{ id: 'stride', kind: 'oscillate', target: 'group:feet', property: 'translateY', amplitude: 4, frequency: 0.25, driver: 'time' }],
    },
  };
  const transforms = evaluatePoseRig(entity, { time: 1 });
  assert.equal(transforms.get(left.id).y.toFixed(3), '4.000');
  assert.equal(transforms.get(right.id).y.toFixed(3), '4.000');
});

test('pose cycle lerps between named transform poses', () => {
  const arm = createCell('club-arm', 'gun', 0, 0);
  const entity = {
    x: 0,
    y: 0,
    cells: [arm],
    poseRig: {
      groups: [{ id: 'arm', cells: ['club-arm'], pivot: [0, 0, 0] }],
      poses: [
        { id: 'back', transforms: [{ target: 'group:arm', translate: [-6, 0, 0], rotation: -Math.PI / 4 }] },
        { id: 'swing', transforms: [{ target: 'group:arm', translate: [6, 0, 0], rotation: Math.PI / 4 }] },
      ],
      animations: [{ id: 'club-swing', kind: 'poseCycle', driver: 'time', frequency: 1, keyframes: [{ at: 0, pose: 'back' }, { at: 1, pose: 'swing' }] }],
    },
  };
  const transform = evaluatePoseRig(entity, { time: 0.5 }).get(arm.id);
  assert.equal(transform.x.toFixed(3), '0.000');
  assert.equal(transform.rotation.toFixed(3), '0.000');
});

test('aim-at-target pose rotates a cannon group around its pivot', () => {
  const cannon = createCell('barrel', 'gun', 0, 0);
  const entity = {
    x: 10,
    y: 20,
    cells: [cannon],
    poseRig: {
      groups: [{ id: 'cannon', cells: ['barrel'], pivot: [0, 0, 0] }],
      animations: [{ id: 'track-player', kind: 'aimAtTarget', target: 'group:cannon' }],
    },
  };
  const transform = evaluatePoseRig(entity, { target: { x: 10, y: 120 } }).get(cannon.id);
  assert.equal(transform.rotation.toFixed(3), (Math.PI / 2).toFixed(3));
});

test('walker stride rig infers leg assembly groups from sculpted support roles', () => {
  const cells = [
    Object.assign(createCell('left-leg-low', 'wheel', -2, -1), { role: 'supportLeg' }),
    Object.assign(createCell('left-leg-armor', 'armor', -2, -1), { role: 'legArmor' }),
    Object.assign(createCell('right-leg-low', 'wheel', 2, -1), { role: 'supportLeg' }),
    Object.assign(createCell('right-leg-joint', 'engine', 2, -1, 1), { role: 'legJoint' }),
  ];
  const rig = createWalkerStridePoseRig({ cells }, { amplitude: CELL_SIZE, frequency: 1 });
  const entity = { x: 0, y: 0, cells, poseRig: rig };
  const transforms = evaluatePoseRig(entity, { phase: 0.25 });
  assert.equal(rig.groups.length, 2);
  assert.equal(Math.abs(transforms.get('left-leg-low').y) > 0, true);
  assert.equal(transforms.get('left-leg-low').y, transforms.get('left-leg-armor').y);
  assert.equal(transforms.get('right-leg-low').y, transforms.get('right-leg-joint').y);
});

test('cell pose transform rotates local cell positions around a group pivot', () => {
  const arm = createCell('arm-end', 'gun', 1, 0);
  const transforms = new Map([
    [
      arm.id,
      {
        x: 0,
        y: 0,
        z: 0,
        rotation: Math.PI / 2,
        pivot: [0, 0, 0],
      },
    ],
  ]);
  const posed = applyCellPoseTransform(arm, { x: CELL_SIZE, y: 0 }, transforms);
  assert.equal(posed.x.toFixed(3), '0.000');
  assert.equal(posed.y.toFixed(3), CELL_SIZE.toFixed(3));
});

test('weighted cell binding with one joint matches legacy rigid group transform', () => {
  const cell = createCell('upper-arm-cell', 'armor', 1, 0);
  const baseRig = {
    groups: [{ id: 'upperArm', cells: [cell.id], pivot: [0, 0, 0] }],
    joints: [{ id: 'upperArmJoint', group: 'upperArm', kind: 'hinge', axis: [0, 0, 1] }],
    animations: [{ id: 'raise', kind: 'oscillate', target: 'group:upperArm', property: 'translateY', amplitude: 6, frequency: 0.25, driver: 'time' }],
  };
  const legacy = applyCellPoseTransform(cell, { x: CELL_SIZE, y: 0 }, evaluatePoseRig({ cells: [cell], poseRig: baseRig }, { time: 1 }));
  const weighted = applyCellPoseTransform(
    cell,
    { x: CELL_SIZE, y: 0 },
    evaluatePoseRig({ cells: [cell], poseRig: { ...baseRig, cellBindings: { [cell.id]: [{ joint: 'upperArmJoint', weight: 1 }] } } }, { time: 1 }),
  );
  assert.deepEqual({ x: weighted.x, y: weighted.y, rotation: weighted.rotation }, { x: legacy.x, y: legacy.y, rotation: legacy.rotation });
});

test('weighted cell bindings blend cell centers between two joints', () => {
  const elbow = createCell('elbow-cell', 'armor', 0, 0);
  const entity = {
    cells: [elbow],
    poseRig: {
      groups: [
        { id: 'upperArm', cells: [elbow.id], pivot: [0, 0, 0] },
        { id: 'forearm', cells: [elbow.id], pivot: [0, 0, 0] },
      ],
      joints: [
        { id: 'upperArmJoint', group: 'upperArm', defaultTransform: { translate: [10, 0, 0] } },
        { id: 'forearmJoint', group: 'forearm', defaultTransform: { translate: [0, 10, 0] } },
      ],
      cellBindings: { [elbow.id]: [{ joint: 'upperArmJoint', weight: 0.5 }, { joint: 'forearmJoint', weight: 0.5 }] },
    },
  };
  const posed = applyCellPoseTransform(elbow, { x: 0, y: 0 }, evaluatePoseRig(entity, { time: 0 }));
  assert.equal(posed.x.toFixed(3), '5.000');
  assert.equal(posed.y.toFixed(3), '5.000');
});

test('weighted orientation blend handles angle wrapping', () => {
  const blade = createCell('blade-cell', 'gun', 1, 0);
  const rig = {
    groups: [
      { id: 'leftSwing', cells: [blade.id], pivot: [0, 0, 0] },
      { id: 'rightSwing', cells: [blade.id], pivot: [0, 0, 0] },
    ],
    joints: [
      { id: 'leftJoint', group: 'leftSwing', defaultTransform: { rotation: Math.PI - 0.1, pivot: [0, 0, 0] } },
      { id: 'rightJoint', group: 'rightSwing', defaultTransform: { rotation: -Math.PI + 0.1, pivot: [0, 0, 0] } },
    ],
    cellBindings: { [blade.id]: [{ joint: 'leftJoint', weight: 0.5 }, { joint: 'rightJoint', weight: 0.5 }] },
  };
  const transform = evaluatePoseRig({ cells: [blade], poseRig: rig }, { time: 0 }).get(blade.id);
  assert.equal(Math.abs(transform.rotation) > 3, true);
});

test('weight helpers normalize bindings and derive rigid defaults from groups', () => {
  const core = createCell('core', 'core', 0, 0);
  const gun = createCell('gun', 'gun', 0, -1);
  const normalized = normalizeCellWeights({ gun: { shoulder: 2, elbow: 2 } });
  assert.deepEqual(normalized.gun, [{ joint: 'shoulder', weight: 0.5 }, { joint: 'elbow', weight: 0.5 }]);
  assert.deepEqual(
    deriveRigidCellBindings(
      { cells: [core, gun] },
      { groups: [{ id: 'guns', selector: 'type:gun' }], joints: [{ id: 'gunJoint', group: 'guns' }] },
    ),
    { gun: [{ joint: 'gunJoint', weight: 1 }] },
  );
});
