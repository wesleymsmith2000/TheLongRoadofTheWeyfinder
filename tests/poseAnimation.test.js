import test from 'node:test';
import assert from 'node:assert/strict';
import { createCell } from '../src/core/cell.js';
import { applyCellPoseTransform, createWalkerStridePoseRig, evaluatePoseRig } from '../src/core/poseAnimation.js';
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
