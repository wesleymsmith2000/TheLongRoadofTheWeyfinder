export function createSpatialHash(options = {}) {
  const cellSize = Math.max(1, Number(options.cellSize) || 64);
  const buckets = new Map();
  const entries = new Map();
  let sequence = 0;
  let lastQueryCandidates = 0;

  function bucketCoordinate(value) {
    return Math.floor(value / cellSize);
  }

  function bucketKey(x, y) {
    return `${x},${y}`;
  }

  function insertEntry(entry) {
    const minBucketX = bucketCoordinate(entry.minX);
    const maxBucketX = bucketCoordinate(entry.maxX);
    const minBucketY = bucketCoordinate(entry.minY);
    const maxBucketY = bucketCoordinate(entry.maxY);
    entries.set(entry.id, entry);
    for (let y = minBucketY; y <= maxBucketY; y += 1) {
      for (let x = minBucketX; x <= maxBucketX; x += 1) {
        const key = bucketKey(x, y);
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = [];
          buckets.set(key, bucket);
        }
        bucket.push(entry);
      }
    }
    return entry;
  }

  function queryAabb(minX, minY, maxX, maxY, mask, out = []) {
    out.length = 0;
    const results = [];
    const seen = new Set();
    const minBucketX = bucketCoordinate(minX);
    const maxBucketX = bucketCoordinate(maxX);
    const minBucketY = bucketCoordinate(minY);
    const maxBucketY = bucketCoordinate(maxY);
    let candidates = 0;
    for (let y = minBucketY; y <= maxBucketY; y += 1) {
      for (let x = minBucketX; x <= maxBucketX; x += 1) {
        const bucket = buckets.get(bucketKey(x, y));
        if (!bucket) continue;
        for (const entry of bucket) {
          candidates += 1;
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          if (!categoryMatches(entry.category, mask)) continue;
          if (!aabbIntersects(entry, minX, minY, maxX, maxY)) continue;
          results.push(entry);
        }
      }
    }
    lastQueryCandidates = candidates;
    results.sort((a, b) => a.order - b.order);
    out.push(...results);
    return out;
  }

  function queryCircle(x, y, radius, mask, out = []) {
    const candidates = queryAabb(x - radius, y - radius, x + radius, y + radius, mask, out);
    let write = 0;
    for (const entry of candidates) {
      if (circleIntersectsAabb(x, y, radius, entry)) {
        candidates[write] = entry;
        write += 1;
      }
    }
    candidates.length = write;
    return candidates;
  }

  return {
    cellSize,
    clear() {
      buckets.clear();
      entries.clear();
      sequence = 0;
      lastQueryCandidates = 0;
    },
    insertCircle(id, x, y, radius = 0, category = null) {
      const r = Math.max(0, Number(radius) || 0);
      return insertEntry({
        id,
        x,
        y,
        radius: r,
        category,
        minX: x - r,
        minY: y - r,
        maxX: x + r,
        maxY: y + r,
        order: sequence++,
      });
    },
    insertSweptCircle(id, x0, y0, x1, y1, radius = 0, category = null) {
      const r = Math.max(0, Number(radius) || 0);
      return insertEntry({
        id,
        x: x1,
        y: y1,
        x0,
        y0,
        x1,
        y1,
        radius: r,
        category,
        minX: Math.min(x0, x1) - r,
        minY: Math.min(y0, y1) - r,
        maxX: Math.max(x0, x1) + r,
        maxY: Math.max(y0, y1) + r,
        order: sequence++,
      });
    },
    queryAabb,
    queryCircle,
    stats() {
      return {
        cellSize,
        bucketCount: buckets.size,
        entryCount: entries.size,
        lastQueryCandidates,
      };
    },
  };
}

function categoryMatches(category, mask) {
  if (mask == null) return true;
  if (typeof mask === 'function') return Boolean(mask(category));
  if (mask instanceof Set) return mask.has(category);
  if (Array.isArray(mask)) return mask.includes(category);
  return category === mask;
}

function aabbIntersects(entry, minX, minY, maxX, maxY) {
  return entry.maxX >= minX && entry.minX <= maxX && entry.maxY >= minY && entry.minY <= maxY;
}

function circleIntersectsAabb(x, y, radius, entry) {
  const nearestX = clamp(x, entry.minX, entry.maxX);
  const nearestY = clamp(y, entry.minY, entry.maxY);
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
