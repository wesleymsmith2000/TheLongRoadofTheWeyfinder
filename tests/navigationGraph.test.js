import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNavigationRuntime,
  hydrateNavigationRuntime,
  navigationView,
  selectNavigationEdge,
  serializeNavigationRuntime,
  stepNavigationRuntime,
  validateNavigationGraph,
} from '../src/core/navigationGraph.js';

const RELAY_GRAPH = {
  schemaVersion: '0.1',
  assetId: 'navigation.test.relay',
  initialNode: 'origin',
  visibleHorizon: 1,
  nodes: [
    { id: 'origin', kind: 'relay', title: 'Origin' },
    { id: 'safe-loop', kind: 'level', title: 'Familiar Signal', signals: { threat: 0.1, fatePressure: 0.7, clarity: 0.8 } },
    { id: 'danger-road', kind: 'level', title: 'Storm Relay', signals: { threat: 0.8, roadCoherence: 0.9, clarity: 0.7 } },
    { id: 'recovery', kind: 'station', title: 'Recovered Anchor' },
    { id: 'helios', kind: 'boss', title: 'Wounded Helios', destination: true, tags: ['destination'] },
  ],
  edges: [
    { id: 'comfortable', from: 'origin', to: 'safe-loop', preview: { stability: 'high' }, signals: { alignment: -0.6 } },
    { id: 'stormward', from: 'origin', to: 'danger-road', preview: { stability: 'low' }, signals: { alignment: 0.7 } },
    { id: 'loop-back', from: 'safe-loop', to: 'origin' },
    { id: 'recover', from: 'safe-loop', to: 'recovery' },
    { id: 'rejoin', from: 'recovery', to: 'danger-road' },
    { id: 'destination', from: 'danger-road', to: 'helios' },
  ],
};

test('navigation graphs validate branches, loops, and destination topology', () => {
  const report = validateNavigationGraph(RELAY_GRAPH);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('partially observed navigation only exposes the configured horizon', () => {
  const runtime = createNavigationRuntime(RELAY_GRAPH, { seed: 42 });
  const view = navigationView(runtime);
  assert.deepEqual(view.nodes.map((node) => node.id).sort(), ['danger-road', 'origin', 'safe-loop']);
  assert.equal(view.nodes.some((node) => node.id === 'helios'), false);
  assert.equal(view.axes, undefined);
  assert.equal(view.choices.length, 2);
  assert.equal(view.choices[0].signals, undefined);
});

test('branch selection updates hidden relational state independently of threat', () => {
  const runtime = createNavigationRuntime(RELAY_GRAPH, { seed: 42 });
  const result = selectNavigationEdge(runtime, 'stormward');
  assert.equal(result.ok, true);
  assert.equal(runtime.currentNodeId, 'danger-road');
  assert.equal(runtime.targetAxes.alignment, 0.7);
  assert.equal(runtime.targetAxes.threat, 0.8);
  assert.equal(runtime.targetMusicMix.roadBearing > 0, true);
  assert.equal(runtime.targetMusicMix.dangerLayer, 0.8);
  stepNavigationRuntime(runtime, 1);
  assert.equal(runtime.axes.alignment > 0, true);
});

test('navigation runtime serializes without lookup maps and hydrates its branch choices', () => {
  const runtime = createNavigationRuntime(RELAY_GRAPH, { seed: 7 });
  selectNavigationEdge(runtime, 'comfortable');
  selectNavigationEdge(runtime, 'loop-back');
  const saved = serializeNavigationRuntime(runtime);
  const restored = hydrateNavigationRuntime(saved);
  assert.equal(restored.currentNodeId, 'origin');
  assert.equal(restored.history.repeatedNodes, 1);
  assert.equal(restored._index.nodes.get('helios').id, 'helios');
  assert.equal(Object.hasOwn(saved, '_index'), false);
});
