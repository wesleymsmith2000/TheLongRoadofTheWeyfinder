import { rotatePoint } from './math.js';

const DEFAULT_ROUTE_SEGMENT_COUNT = 28;

export const DEFAULT_ROAD_ROUTE = deepFreezeRoute(createProceduralRoadRoute(1147));

export function createProceduralRoadRoute(seed = 1147, options = {}) {
  let state = (seed >>> 0) || 1147;
  let previousSign = nextUnit() < 0.5 ? -1 : 1;
  const segments = [
    { id: 'road.start.straight', length: 2600, turnRadians: 0 },
  ];

  for (let index = 0; index < DEFAULT_ROUTE_SEGMENT_COUNT; index += 1) {
    const straightLength = 1600 + nextUnit() * 1700;
    segments.push({ id: `road.straight.${index}`, length: straightLength, turnRadians: 0 });

    const sign = nextUnit() < 0.68 ? -previousSign : previousSign;
    previousSign = sign;
    const magnitude = Math.PI / 10 + nextUnit() * (Math.PI / 7.5);
    const turnLength = 1050 + nextUnit() * 950;
    segments.push({ id: `road.curve.${index}`, length: turnLength, turnRadians: sign * magnitude, curve: 'bezier' });
  }

  return {
    startX: options.startX ?? 0,
    startY: options.startY ?? 0,
    startHeading: options.startHeading ?? 0,
    routePadding: options.routePadding,
    segments,
  };

  function nextUnit() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  }
}

export function sampleRoadRoute(route = DEFAULT_ROAD_ROUTE, distance = 0) {
  const segments = validSegments(route);
  let x = route.startX ?? 0;
  let y = route.startY ?? 0;
  let heading = route.startHeading ?? 0;
  let remaining = Math.max(0, distance);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const length = segmentLength(segment);
    const travel = Math.min(remaining, length);
    const pose = advanceAlongSegment(x, y, heading, segment, travel);
    if (remaining <= length) {
      return {
        ...pose,
        segment,
        segmentIndex: index,
        segmentDistance: travel,
        segmentProgress: length > 0 ? travel / length : 1,
      };
    }
    x = pose.x;
    y = pose.y;
    heading = pose.heading;
    remaining -= length;
  }

  const forward = rotatePoint(0, -1, heading);
  return {
    x: x + forward.x * remaining,
    y: y + forward.y * remaining,
    heading,
    segment: null,
    segmentIndex: segments.length,
    segmentDistance: remaining,
    segmentProgress: 1,
  };
}

export function roadRouteLength(route = DEFAULT_ROAD_ROUTE) {
  return validSegments(route).reduce((sum, segment) => sum + segmentLength(segment), 0);
}

export function isRouteTurnSegment(segment) {
  return Math.abs(segment?.turnRadians ?? 0) > 0.0001;
}

function advanceAlongSegment(x, y, heading, segment, distance) {
  const length = segmentLength(segment);
  const turnRadians = Number.isFinite(segment?.turnRadians) ? segment.turnRadians : 0;
  if (length <= 0 || distance <= 0) return { x, y, heading };
  if (segment?.curve === 'bezier' || segment?.curve === 'spline') {
    return advanceAlongBezierSegment(x, y, heading, segment, distance, length, turnRadians);
  }
  if (Math.abs(turnRadians) <= 0.000001) {
    const forward = rotatePoint(0, -1, heading);
    return {
      x: x + forward.x * distance,
      y: y + forward.y * distance,
      heading,
    };
  }

  const turnRate = turnRadians / length;
  const endHeading = heading + turnRate * distance;
  return {
    x: x + (Math.cos(heading) - Math.cos(endHeading)) / turnRate,
    y: y + (Math.sin(heading) - Math.sin(endHeading)) / turnRate,
    heading: endHeading,
  };
}

function advanceAlongBezierSegment(x, y, heading, segment, distance, length, turnRadians) {
  const t = clamp01(distance / length);
  const endHeading = heading + turnRadians;
  const forward = rotatePoint(0, -1, heading);
  const endForward = rotatePoint(0, -1, endHeading);
  const controlScale = clamp01(segment.controlScale ?? 0.38);
  const endBias = clamp01(segment.endBias ?? 0.52);
  const startWeight = 1 - endBias;
  const p0 = { x, y };
  const p3 = {
    x: x + forward.x * length * startWeight + endForward.x * length * endBias,
    y: y + forward.y * length * startWeight + endForward.y * length * endBias,
  };
  const p1 = {
    x: p0.x + forward.x * length * controlScale,
    y: p0.y + forward.y * length * controlScale,
  };
  const p2 = {
    x: p3.x - endForward.x * length * controlScale,
    y: p3.y - endForward.y * length * controlScale,
  };
  const point = cubicBezierPoint(p0, p1, p2, p3, t);
  const tangent = cubicBezierTangent(p0, p1, p2, p3, t);
  return {
    x: point.x,
    y: point.y,
    heading: headingFromForward(tangent),
  };
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function cubicBezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

function headingFromForward(vector) {
  if (Math.hypot(vector.x, vector.y) <= 0.000001) return 0;
  return Math.atan2(vector.x, -vector.y);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function validSegments(route) {
  return Array.isArray(route?.segments) && route.segments.length > 0 ? route.segments : DEFAULT_ROAD_ROUTE.segments;
}

function segmentLength(segment) {
  return Number.isFinite(segment?.length) && segment.length > 0 ? segment.length : 1;
}

function deepFreezeRoute(route) {
  route.segments = Object.freeze(route.segments.map((segment) => Object.freeze({ ...segment })));
  return Object.freeze(route);
}
