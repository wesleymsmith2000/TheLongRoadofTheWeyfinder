import test from 'node:test';
import assert from 'node:assert/strict';
import {
  animationGraphSummary,
  createAnimationGraphExample,
  validateAnimationGraph,
} from '../src/editor/animationGraphAuthoring.js';
import { validateAnimationGraph as validateRuntimeAnimationGraph } from '../src/core/animationGraph.js';

const poseRig = {
  poses: [
    { id: 'pose.idle_center' },
    { id: 'pose.idle_left' },
    { id: 'pose.stretch' },
    { id: 'pose.alert' },
  ],
  clips: [
    { id: 'look_left' },
    { id: 'look_center' },
    { id: 'rig.stretch_forward' },
    { id: 'rig.stretch_twitch' },
    { id: 'rig.alert' },
  ],
};

test('key-state graph fixture validates against authored rig poses and clips', () => {
  const graph = createAnimationGraphExample();
  const report = validateAnimationGraph(graph, poseRig);

  assert.equal(report.valid, true);
  assert.equal(graph.transitions.find((transition) => transition.id === 'idle-to-stretch').interruptAnchors.length, 2);
  assert.equal(animationGraphSummary(graph), '4 states, 4 transitions, 2 interrupt anchors, 2 variants');
  assert.equal(validateRuntimeAnimationGraph(graph, { poseRig }).valid, true);
});

test('animation graph validation rejects unknown endpoints clips and anchor times', () => {
  const graph = createAnimationGraphExample();
  graph.transitions.push({
    id: 'bad-transition',
    from: 'missing',
    to: 'alert',
    duration: { min: 0, max: 0 },
    channels: { rig: { clip: 'missing.clip' } },
    interruptPolicy: 'AT_NEXT_ANCHOR',
    interruptAnchors: [{ id: 'late', at: 1.2, tags: ['grounded'] }],
  });
  const report = validateAnimationGraph(graph, poseRig);

  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('unknown state "missing"')), true);
  assert.equal(report.errors.some((error) => error.includes('unknown rig clip "missing.clip"')), true);
  assert.equal(report.errors.some((error) => error.includes('between 0 and 1')), true);
});

test('animation graph warns about autonomous choices with no authored transition', () => {
  const graph = createAnimationGraphExample();
  graph.transitions = graph.transitions.filter((transition) => transition.from !== 'idle-left');
  const report = validateAnimationGraph(graph, poseRig);

  assert.equal(report.warnings.some((warning) => warning.includes('idle-left') && warning.includes('no authored outgoing transition')), true);
});
