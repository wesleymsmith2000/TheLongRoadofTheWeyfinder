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
    segments.push({ id: `road.curve.${index}`, length: turnLength, turnRadians: sign * magnitude });
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
