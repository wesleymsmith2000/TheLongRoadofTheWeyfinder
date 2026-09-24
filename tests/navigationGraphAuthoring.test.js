import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNavigationGraphExample,
  previewNavigationScore,
  validateNavigationGraph,
} from '../src/editor/navigationGraphAuthoring.js';
import { validateNavigationGraph as validateRuntimeNavigationGraph } from '../src/core/navigationGraph.js';

test('relay web example validates and preserves partially observed topology', () => {
  const graph = createNavigationGraphExample();
  const report = validateNavigationGraph(graph);

  assert.equal(report.valid, true);
  assert.equal(graph.visibleHorizon, 2);
  assert.equal(graph.edges.some((edge) => edge.visibility === 'FALSE_ECHO'), true);
  assert.equal(graph.nodes.some((node) => node.signals.alignment > 0 && node.signals.threat > 0.5), true);
  assert.equal(validateRuntimeNavigationGraph(graph).valid, true);
});

test('navigation validation rejects duplicate nodes and unknown edge endpoints', () => {
  const graph = createNavigationGraphExample();
  graph.nodes.push({ ...graph.nodes[0] });
  graph.edges.push({ id: 'lost', from: 'missing', to: 'relay-entry', visibility: 'VISIBLE', weight: 1 });
  const report = validateNavigationGraph(graph);

  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('duplicated')), true);
  assert.equal(report.errors.some((error) => error.includes('unknown node "missing"')), true);
});

test('navigation preview keeps direction and danger as independent signals', () => {
  const preview = previewNavigationScore({
    navigation: { alignment: 0.8, threat: 0.8, clarity: 0.7, fatePressure: 0.2, roadCoherence: 0.75, destinationSignal: 0.6, ambushRisk: 0.1 },
  });

  assert.equal(preview.label, 'Faint Bearing');
  assert.equal(preview.mix.roadBearing > 0, true);
  assert.equal(preview.mix.dangerLayer, 0.8);
});
