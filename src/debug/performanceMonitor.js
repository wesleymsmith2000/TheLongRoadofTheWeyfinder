const DEFAULT_WINDOW = 180;
const THRESHOLDS = [33, 50, 100];

export function createPerformanceMonitor(options = {}) {
  const windowSize = Math.max(30, Math.floor(options.windowSize ?? DEFAULT_WINDOW));
  const now = options.now ?? (() => performance.now());
  const samples = [];
  let active = null;

  return {
    beginFrame(timestamp = now()) {
      active = {
        start: timestamp,
        cursor: timestamp,
        slices: {},
        counters: {},
      };
    },
    mark(name, timestamp = now()) {
      if (!active) return;
      active.slices[name] = (active.slices[name] ?? 0) + Math.max(0, timestamp - active.cursor);
      active.cursor = timestamp;
    },
    endFrame(counters = {}, timestamp = now()) {
      if (!active) return summary(samples, windowSize);
      const frameMs = Math.max(0, timestamp - active.start);
      const sample = {
        frameMs,
        slices: { ...active.slices },
        counters: { ...counters },
      };
      samples.push(sample);
      while (samples.length > windowSize) samples.shift();
      active = null;
      return summary(samples, windowSize);
    },
    summary() {
      return summary(samples, windowSize);
    },
    reset() {
      samples.length = 0;
      active = null;
    },
  };
}

export function summarizePerformanceSamples(samples = []) {
  return summary(samples, Math.max(samples.length, 1));
}

function summary(samples, windowSize) {
  const frameTimes = samples.map((sample) => sample.frameMs);
  const sliceNames = new Set(samples.flatMap((sample) => Object.keys(sample.slices ?? {})));
  const counterNames = new Set(samples.flatMap((sample) => Object.keys(sample.counters ?? {})));
  const slices = {};
  const counters = {};
  for (const name of sliceNames) slices[name] = summarizeNumbers(samples.map((sample) => sample.slices?.[name] ?? 0));
  for (const name of counterNames) counters[name] = lastFinite(samples.map((sample) => sample.counters?.[name]));
  return {
    sampleCount: samples.length,
    windowSize,
    frame: summarizeNumbers(frameTimes),
    slowFrames: Object.fromEntries(THRESHOLDS.map((threshold) => [`over${threshold}ms`, frameTimes.filter((value) => value > threshold).length])),
    slices,
    counters,
  };
}

function summarizeNumbers(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return { avg: 0, p95: 0, max: 0 };
  const avg = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const p95 = finite[Math.min(finite.length - 1, Math.floor(finite.length * 0.95))];
  return { avg, p95, max: finite[finite.length - 1] };
}

function lastFinite(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index];
  }
  return 0;
}
