import test from 'node:test';
import assert from 'node:assert/strict';
import spideryWalkerConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spidery_walker_sculpted.json' with { type: 'json' };
import rotatableBossCannonConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.rotatable_boss_cannon_sculpted.json' with { type: 'json' };
import { validateConstructDefinition } from '../src/core/constructDefinition.js';
import {
  createAnimationDescriptor,
  createCellBindingDescriptor,
  createCannonAimRigForConstruct,
  createGroupDescriptor,
  createPoseTransformDescriptor,
  createWalkerStrideRigForConstruct,
  hasPoseRigContent,
  poseRigFromConstructDefinition,
  poseRigSummary,
} from '../src/editor/poseRigAuthoring.js';

test('pose rig authoring normalizes construct aliases into nested runtime shape', () => {
  const rig = poseRigFromConstructDefinition({
    cellGroups: [{ id: 'turret', selector: 'type:gun' }],
    joints: [{ id: 'turret-hinge', group: 'turret', kind: 'hinge' }],
    poses: [{ id: 'left', transforms: [{ target: 'group:turret', rotation: -0.5 }] }],
    poseAnimations: [{ id: 'sweep', kind: 'poseCycle', keyframes: [{ at: 0, pose: 'left' }] }],
  });

  assert.equal(rig.groups[0].id, 'turret');
  assert.equal(rig.animations[0].id, 'sweep');
  assert.equal(poseRigSummary(rig), '1 groups, 1 joints, 1 poses, 1 animations, 0 weighted cells');
});

test('pose rig authoring creates compact descriptors from form-friendly values', () => {
  const group = createGroupDescriptor({
    id: 'front left leg',
    selector: 'role:supportLeg',
    cells: 'foot-a, knee-a\nhip-a',
    pivot: ['-12', '24', '0'],
    role: 'legAssembly',
  });
  const transform = createPoseTransformDescriptor({
    target: 'group:front-left-leg',
    translate: '0, -8, 0',
    rotation: '0.25',
  });
  const animation = createAnimationDescriptor({
    id: 'leg bob',
    kind: 'oscillate',
    target: 'group:front-left-leg',
    property: 'translateY',
    amplitude: '16',
    frequency: '0.9',
    phase: '3.14',
    driver: 'phase',
  });

  assert.equal(group.id, 'front-left-leg');
  assert.deepEqual(group.cells, ['foot-a', 'knee-a', 'hip-a']);
  assert.deepEqual(group.pivot, [-12, 24, 0]);
  assert.deepEqual(transform.translate, [0, -8, 0]);
  assert.equal(transform.rotation, 0.25);
  assert.equal(animation.id, 'leg-bob');
  assert.equal(animation.driver, 'phase');
});

test('pose rig authoring creates normalized weighted binding descriptors', () => {
  const binding = createCellBindingDescriptor({
    cellId: 'elbow',
    influences: { upperArmJoint: 2, forearmJoint: 2 },
  });

  assert.equal(binding.cellId, 'elbow');
  assert.deepEqual(binding.influences, [{ joint: 'upperArmJoint', weight: 0.5 }, { joint: 'forearmJoint', weight: 0.5 }]);
});

test('walker stride preset emits a valid construct pose rig for sculpted walkers', () => {
  const poseRig = createWalkerStrideRigForConstruct(spideryWalkerConstruct);
  const report = validateConstructDefinition({ ...spideryWalkerConstruct, poseRig });

  assert.equal(hasPoseRigContent(poseRig), true);
  assert.equal(report.valid, true);
  assert.equal(poseRig.groups.every((group) => group.role === 'legAssembly'), true);
  assert.equal(poseRig.animations.every((animation) => animation.kind === 'oscillate'), true);
});

test('cannon aim preset emits a valid rotating cannon rig', () => {
  const poseRig = createCannonAimRigForConstruct(rotatableBossCannonConstruct);
  const report = validateConstructDefinition({ ...rotatableBossCannonConstruct, poseRig });

  assert.equal(report.valid, true);
  assert.equal(poseRig.groups[0].id, 'mainCannon');
  assert.equal(poseRig.joints[0].kind, 'hinge');
  assert.equal(poseRig.animations[0].kind, 'aimAtTarget');
  assert.equal(poseRig.animations[0].target, 'group:mainCannon');
});
