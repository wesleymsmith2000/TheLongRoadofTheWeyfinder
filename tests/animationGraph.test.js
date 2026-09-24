import test from 'node:test';
import assert from 'node:assert/strict';
import { createCell } from '../src/core/cell.js';
import {
  animationControllerView,
  consumeAnimationMarkers,
  createAnimationController,
  hydrateAnimationController,
  requestAnimationState,
  serializeAnimationController,
  stepAnimationGraph,
  validateAnimationGraph,
} from '../src/core/animationGraph.js';
import { evaluatePoseRig } from '../src/core/poseAnimation.js';

const POSE_RIG = {
  groups: [{ id: 'body', cells: ['core'], pivot: [0, 0, 0] }],
  poses: [
    { id: 'pose.idle', transforms: [{ target: 'group:body', translate: [0, 0, 0], rotation: 0 }] },
    { id: 'pose.stretch', transforms: [{ target: 'group:body', translate: [10, 0, 0], rotation: 1 }] },
    { id: 'pose.alert', transforms: [{ target: 'group:body', translate: [0, -8, 0], rotation: -0.5 }] },
  ],
  clips: [],
};

const GRAPH = {
  schemaVersion: '0.1',
  initialState: 'idle',
  states: [
    { id: 'idle', tags: ['stable'], rig: { pose: 'pose.idle' }, dwell: { min: 1, max: 2 }, next: [{ state: 'stretch', weight: 1 }] },
    { id: 'stretch', rig: { pose: 'pose.stretch' }, dwell: 1 },
    { id: 'alert', rig: { pose: 'pose.alert' }, dwell: 1 },
  ],
  transitions: [
    {
      id: 'idle-stretch-a',
      from: 'idle',
      to: 'stretch',
      weight: 3,
      duration: { min: 0.9, max: 1.1 },
      interruptPolicy: 'IMMEDIATE',
      interruptAnchors: [{ id: 'balanced', at: 0.5, tags: ['balanced', 'grounded'] }],
      markers: [{ id: 'footfall', at: 0.5, tags: ['sound'] }],
      variants: [{ id: 'slow', weight: 2 }, { id: 'quick', weight: 1, duration: 0.7 }],
    },
    { id: 'idle-stretch-b', from: 'idle', to: 'stretch', weight: 1, duration: 0.8 },
    { id: 'stretch-alert', from: 'stretch', to: 'alert', duration: 0.4 },
    { id: 'idle-alert', from: 'idle', to: 'alert', duration: 0.3 },
  ],
};

function entity(seed = 11) {
  const value = {
    id: 'fixture',
    cells: [createCell('core', 'core', 0, 0)],
    poseRig: structuredClone(POSE_RIG),
    animationGraph: structuredClone(GRAPH),
    animationStateMap: { idle: 'idle', alert: 'alert', stretch: 'stretch' },
  };
  value.animationController = createAnimationController(value.animationGraph, { seed, entityId: value.id, poseRig: value.poseRig });
  return value;
}

function advance(value, seconds, step = 0.05) {
  let elapsed = 0;
  while (elapsed < seconds - 0.000001) {
    const dt = Math.min(step, seconds - elapsed);
    stepAnimationGraph(value, dt);
    elapsed += dt;
  }
}

test('animation graph validates semantic states, transitions, anchors, and pose references', () => {
  const report = validateAnimationGraph(GRAPH, { poseRig: POSE_RIG });
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('animation graph stochastic decisions are deterministic for the same seed', () => {
  const a = entity(77);
  const b = entity(77);
  requestAnimationState(a, 'stretch');
  requestAnimationState(b, 'stretch');
  stepAnimationGraph(a, 0);
  stepAnimationGraph(b, 0);
  assert.equal(a.animationController.currentTransitionId, b.animationController.currentTransitionId);
  assert.equal(a.animationController.currentVariantId, b.animationController.currentVariantId);
  assert.equal(a.animationController.transitionDuration, b.animationController.transitionDuration);
  assert.equal(a.animationController.rngState, b.animationController.rngState);
});

test('normal semantic transition reaches and settles in its target key state', () => {
  const value = entity();
  requestAnimationState(value, 'stretch');
  advance(value, 2);
  const view = animationControllerView(value);
  assert.equal(view.currentStateId, 'stretch');
  assert.equal(view.currentTransitionId, null);
});

test('AT_NEXT_ANCHOR waits until the authored interrupt point before branching', () => {
  const value = entity(4);
  requestAnimationState(value, 'stretch');
  stepAnimationGraph(value, 0);
  value.animationController.transitionDuration = 1;
  advance(value, 0.43);
  requestAnimationState(value, 'alert', { interruptPolicy: 'AT_NEXT_ANCHOR', priority: 50 });
  advance(value, 0.05);
  assert.equal(value.animationController.transitionToStateId, 'stretch');
  advance(value, 0.03);
  assert.equal(value.animationController.transitionToStateId, 'alert');
  assert.equal(consumeAnimationMarkers(value).some((marker) => marker.type === 'interruptAnchor' && marker.id === 'balanced'), true);
});

test('REQUIRE_TAG routes through a transition carrying the requested anchor tag', () => {
  const value = entity(9);
  requestAnimationState(value, 'alert', { interruptPolicy: 'REQUIRE_TAG', requiredAnchorTags: ['grounded'] });
  stepAnimationGraph(value, 0);
  value.animationController.transitionDuration = 1;
  assert.equal(value.animationController.transitionToStateId, 'stretch');
  advance(value, 0.51);
  assert.equal(value.animationController.transitionToStateId, 'alert');
});

test('immediate interruption preserves the current evaluated pose then converges', () => {
  const value = entity(12);
  requestAnimationState(value, 'stretch');
  stepAnimationGraph(value, 0);
  value.animationController.transitionDuration = 1;
  advance(value, 0.43);
  const before = evaluatePoseRig(value, { time: 0.43 }).get('core');
  requestAnimationState(value, 'alert', { interruptPolicy: 'IMMEDIATE', priority: 80 });
  stepAnimationGraph(value, 0);
  const interrupted = evaluatePoseRig(value, { time: 0.43 }).get('core');
  assert.equal(interrupted.x.toFixed(6), before.x.toFixed(6));
  assert.equal(interrupted.y.toFixed(6), before.y.toFixed(6));
  assert.equal(interrupted.rotation.toFixed(6), before.rotation.toFixed(6));
  advance(value, 0.5);
  const settled = evaluatePoseRig(value, { time: 0.93 }).get('core');
  assert.equal(settled.y < -7, true);
});

test('controller save and hydration preserve transition progress and RNG sequence', () => {
  const value = entity(18);
  requestAnimationState(value, 'stretch');
  stepAnimationGraph(value, 0);
  advance(value, 0.2);
  const saved = serializeAnimationController(value.animationController);
  const restored = hydrateAnimationController(value.animationGraph, saved, { seed: 18, entityId: value.id, poseRig: value.poseRig });
  assert.equal(restored.currentTransitionId, value.animationController.currentTransitionId);
  assert.equal(restored.transitionTime, value.animationController.transitionTime);
  assert.equal(restored.rngState, value.animationController.rngState);
});
