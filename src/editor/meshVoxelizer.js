import { CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';

const AXES = ['x', 'y', 'z'];

export function parseMeshText(text, filename = 'mesh.obj') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.stl') || looksLikeAsciiStl(text)) return parseAsciiStl(text);
  return parseObj(text);
}

export function parseMeshBuffer(buffer, filename = 'mesh.obj') {
  const lower = filename.toLowerCase();
  if (!lower.endsWith('.stl')) return parseMeshText(new TextDecoder().decode(buffer), filename);
  if (looksLikeBinaryStl(buffer)) return parseBinaryStl(buffer);
  return parseAsciiStl(new TextDecoder().decode(buffer));
}

export function parseObj(text) {
  const vertices = [];
  const triangles = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v' && parts.length >= 4) {
      vertices.push(point(Number(parts[1]), Number(parts[2]), Number(parts[3])));
    } else if (parts[0] === 'f' && parts.length >= 4) {
      const indices = parts.slice(1).map((token) => parseObjFaceIndex(token, vertices.length)).filter((index) => index >= 0 && index < vertices.length);
      for (let i = 1; i < indices.length - 1; i += 1) triangles.push([indices[0], indices[i], indices[i + 1]]);
    }
  }
  return meshFromIndexedTriangles(vertices, triangles, 'obj');
}

export function parseAsciiStl(text) {
  const vertices = [];
  const triangles = [];
  let facet = [];
  for (const match of String(text).matchAll(/vertex\s+([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)/g)) {
    vertices.push(point(Number(match[1]), Number(match[2]), Number(match[3])));
    facet.push(vertices.length - 1);
    if (facet.length === 3) {
      triangles.push(facet);
      facet = [];
    }
  }
  return meshFromIndexedTriangles(vertices, triangles, 'stl');
}

export function parseBinaryStl(buffer) {
  const view = buffer instanceof DataView ? buffer : new DataView(buffer);
  if (view.byteLength < 84) throw new Error('Binary STL is too short.');
  const triangleCount = view.getUint32(80, true);
  const expectedLength = 84 + triangleCount * 50;
  if (view.byteLength < expectedLength) throw new Error('Binary STL ended before all triangles were readable.');

  const vertices = [];
  const triangles = [];
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const triangle = [];
    let offset = 84 + triangleIndex * 50 + 12;
    for (let vertexIndex = 0; vertexIndex < 3; vertexIndex += 1) {
      vertices.push(point(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)));
      triangle.push(vertices.length - 1);
      offset += 12;
    }
    triangles.push(triangle);
  }
  return meshFromIndexedTriangles(vertices, triangles, 'stl');
}

export function voxelizeMeshToConstruct(mesh, options = {}) {
  const span = clampInteger(options.span ?? 9, 3, 31);
  const sampleDensity = clampInteger(options.sampleDensity ?? 4, 1, 12);
  const assetId = safeAssetId(options.assetId ?? 'creator.voxelized_mesh');
  const normalized = normalizeMesh(mesh, span);
  const occupied = sampleMeshOccupancy(normalized, sampleDensity);
  if (occupied.size === 0) throw new Error('Mesh did not produce any occupied cells.');

  const coreKey = nearestOccupiedKey(occupied, normalized.centroid);
  const cells = [...occupied]
    .map((key) => cellFromKey(key, key === coreKey ? 'core' : 'armor'))
    .sort((a, b) => a.gridZ - b.gridZ || a.gridY - b.gridY || a.gridX - b.gridX || a.id.localeCompare(b.id));

  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    assetId,
    displayName: options.displayName ?? titleFromAssetId(assetId),
    author: options.author ?? 'Local creator',
    provenance: `Voxelized from ${mesh.sourceFormat ?? 'mesh'} surface samples.`,
    canonStatus: options.canonStatus ?? 'COMMUNITY',
    tags: ['mesh', 'voxelized', 'construct'],
    cells,
    connections: adjacencyConnections(cells),
    modules: [],
    voxelizer: {
      sourceFormat: mesh.sourceFormat ?? 'mesh',
      sourceVertices: mesh.vertices.length,
      sourceTriangles: mesh.triangles.length,
      span,
      sampleDensity,
    },
  };
}

export function summarizeMesh(mesh) {
  const bounds = meshBounds(mesh.vertices);
  return {
    sourceFormat: mesh.sourceFormat ?? 'mesh',
    vertices: mesh.vertices.length,
    triangles: mesh.triangles.length,
    bounds,
  };
}

function meshFromIndexedTriangles(vertices, triangles, sourceFormat) {
  const cleanVertices = vertices.filter((vertex) => AXES.every((axis) => Number.isFinite(vertex[axis])));
  if (cleanVertices.length !== vertices.length) throw new Error('Mesh contains non-numeric vertices.');
  if (cleanVertices.length === 0) throw new Error('Mesh has no vertices.');
  const cleanTriangles = triangles.filter((triangle) => triangle.length === 3 && triangle.every((index) => Number.isInteger(index)));
  if (cleanTriangles.length === 0) throw new Error('Mesh has no faces to voxelize.');
  return { sourceFormat, vertices: cleanVertices, triangles: cleanTriangles };
}

function parseObjFaceIndex(token, vertexCount) {
  const raw = Number.parseInt(String(token).split('/')[0], 10);
  if (!Number.isInteger(raw)) return -1;
  return raw < 0 ? vertexCount + raw : raw - 1;
}

function looksLikeAsciiStl(text) {
  return /^\s*solid\b/i.test(String(text)) && /\bfacet\s+normal\b/i.test(String(text)) && /\bvertex\b/i.test(String(text));
}

function looksLikeBinaryStl(buffer) {
  const view = buffer instanceof DataView ? buffer : new DataView(buffer);
  if (view.byteLength < 84) return false;
  const triangleCount = view.getUint32(80, true);
  const expectedLength = 84 + triangleCount * 50;
  if (expectedLength === view.byteLength) return true;
  const header = new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset, Math.min(view.byteLength, 256)));
  return !looksLikeAsciiStl(header);
}

function normalizeMesh(mesh, span) {
  const bounds = meshBounds(mesh.vertices);
  const size = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  };
  const maxExtent = Math.max(size.x, size.y, size.z, 0.0001);
  const scale = (span - 1) / maxExtent;
  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const vertices = mesh.vertices.map((vertex) => ({
    x: (vertex.x - center.x) * scale,
    y: (vertex.y - center.y) * scale,
    z: (vertex.z - center.z) * scale + Math.floor(span / 2),
  }));
  const centroid = averagePoint(vertices);
  return { ...mesh, vertices, centroid };
}

function sampleMeshOccupancy(mesh, sampleDensity) {
  const occupied = new Set();
  for (const triangle of mesh.triangles) {
    const a = mesh.vertices[triangle[0]];
    const b = mesh.vertices[triangle[1]];
    const c = mesh.vertices[triangle[2]];
    const steps = Math.max(1, Math.ceil(longestTriangleEdge(a, b, c) * sampleDensity));
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps - i; j += 1) {
        const u = i / steps;
        const v = j / steps;
        const w = 1 - u - v;
        addOccupied(occupied, {
          x: a.x * u + b.x * v + c.x * w,
          y: a.y * u + b.y * v + c.y * w,
          z: a.z * u + b.z * v + c.z * w,
        });
      }
    }
  }
  return occupied;
}

function addOccupied(occupied, sample) {
  occupied.add(keyFor(Math.round(sample.x), Math.round(sample.y), Math.max(0, Math.round(sample.z))));
}

function nearestOccupiedKey(occupied, target) {
  return [...occupied].sort((a, b) => distanceSquared(pointFromKey(a), target) - distanceSquared(pointFromKey(b), target))[0];
}

function cellFromKey(key, type) {
  const { x, y, z } = pointFromKey(key);
  const role = type === 'core' ? 'core' : 'meshSurface';
  return {
    id: `${role}_x${coordinateId(x)}_y${coordinateId(y)}_z${coordinateId(z)}`,
    type,
    gridX: x,
    gridY: y,
    gridZ: z,
    role,
  };
}

function adjacencyConnections(cells) {
  const byKey = new Map(cells.map((cell) => [keyFor(cell.gridX, cell.gridY, cell.gridZ), cell]));
  const connections = [];
  for (const cell of cells) {
    addNeighbor(cell, cell.gridX + 1, cell.gridY, cell.gridZ, 'right');
    addNeighbor(cell, cell.gridX, cell.gridY + 1, cell.gridZ, 'bottom');
    addNeighbor(cell, cell.gridX, cell.gridY, cell.gridZ + 1, 'above');
  }
  return connections;

  function addNeighbor(cell, gridX, gridY, gridZ, side) {
    const neighbor = byKey.get(keyFor(gridX, gridY, gridZ));
    if (!neighbor) return;
    connections.push({ a: cell.id, b: neighbor.id, aSide: side, bSide: oppositeSide(side), type: 'structural' });
  }
}

function oppositeSide(side) {
  return { top: 'bottom', right: 'left', bottom: 'top', left: 'right', above: 'below', below: 'above' }[side];
}

function meshBounds(vertices) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const vertex of vertices) {
    for (const axis of AXES) {
      min[axis] = Math.min(min[axis], vertex[axis]);
      max[axis] = Math.max(max[axis], vertex[axis]);
    }
  }
  return { min, max };
}

function averagePoint(points) {
  const total = points.reduce((sum, next) => ({ x: sum.x + next.x, y: sum.y + next.y, z: sum.z + next.z }), point(0, 0, 0));
  return point(total.x / points.length, total.y / points.length, total.z / points.length);
}

function longestTriangleEdge(a, b, c) {
  return Math.max(Math.sqrt(distanceSquared(a, b)), Math.sqrt(distanceSquared(b, c)), Math.sqrt(distanceSquared(c, a)));
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}

function point(x, y, z) {
  return { x, y, z };
}

function keyFor(x, y, z) {
  return `${x},${y},${z}`;
}

function pointFromKey(key) {
  const [x, y, z] = key.split(',').map(Number);
  return point(x, y, z);
}

function coordinateId(value) {
  return value < 0 ? `n${Math.abs(value)}` : String(value);
}

function safeAssetId(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'creator.voxelized_mesh';
}

function titleFromAssetId(assetId) {
  return assetId
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || min)));
}
