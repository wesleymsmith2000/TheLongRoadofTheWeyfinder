import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerformanceMonitor, summarizePerformanceSamples } from '../src/debug/performanceMonitor.js';
import { createPerformanceDiagnostics, effectiveDpr } from '../src/debug/performanceConfig.js';

test('performance monitor records frame slices counters and slow frame buckets', () => {
  let time = 0;
  const monitor = createPerformanceMonitor({ windowSize: 30, now: () => time });

  monitor.beginFrame(time);
  time += 2;
  monitor.mark('input');
  time += 12;
  monitor.mark('simulation');
  time += 7;
  monitor.mark('render');
  time += 15;
  const summary = monitor.endFrame({ enemyProjectiles: 120, liveEnemyCells: 80 });

  assert.equal(summary.sampleCount, 1);
  assert.equal(summary.frame.max, 36);
  assert.equal(summary.slices.input.avg, 2);
  assert.equal(summary.slices.simulation.avg, 12);
  assert.equal(summary.slices.render.avg, 7);
  assert.equal(summary.slowFrames.over33ms, 1);
  assert.equal(summary.slowFrames.over50ms, 0);
  assert.equal(summary.counters.enemyProjectiles, 120);
  assert.equal(summary.counters.liveEnemyCells, 80);
});

test('performance sample summaries report p95 and max deterministically', () => {
  const samples = Array.from({ length: 20 }, (_, index) => ({
    frameMs: index + 1,
    slices: { simulation: index % 2 === 0 ? 4 : 8 },
    counters: { enemyProjectiles: index * 10 },
  }));
  const summary = summarizePerformanceSamples(samples);

  assert.equal(summary.frame.avg, 10.5);
  assert.equal(summary.frame.p95, 20);
  assert.equal(summary.frame.max, 20);
  assert.equal(summary.slices.simulation.avg, 6);
  assert.equal(summary.counters.enemyProjectiles, 190);
});

test('performance monitor can run counters-only or off', () => {
  let time = 0;
  let mode = 'counters';
  const monitor = createPerformanceMonitor({ windowSize: 30, now: () => time, getMode: () => mode, summaryIntervalMs: 0 });

  monitor.beginFrame(time);
  time += 4;
  monitor.mark('simulation');
  time += 6;
  const countersOnly = monitor.endFrame({ enemyProjectiles: 42 });

  assert.equal(countersOnly.frame.max, 10);
  assert.equal(countersOnly.slices.simulation.max, 0);
  assert.equal(countersOnly.counters.enemyProjectiles, 42);

  mode = 'off';
  monitor.beginFrame(time);
  time += 100;
  const disabled = monitor.endFrame({ enemyProjectiles: 99 });
  assert.equal(disabled.counters.enemyProjectiles, 42);
});

test('performance diagnostics expose mobile DPR cap and runtime toggles', () => {
  const diagnostics = createPerformanceDiagnostics({}, { matchMedia: () => ({ matches: true }) });
  assert.equal(diagnostics.state.dprMode, '1.5');
  assert.equal(diagnostics.monitorMode(), 'off');
  diagnostics.set({ perfMonitorOff: false });
  assert.equal(diagnostics.monitorMode(), 'full');
  assert.equal(diagnostics.effectiveDpr(3), 1.5);
  assert.deepEqual(diagnostics.set({ noSfx: true, dprMode: '1' }).noSfx, true);
  assert.equal(effectiveDpr(3, 'native'), 3);
  assert.equal(effectiveDpr(3, '1'), 1);
});
