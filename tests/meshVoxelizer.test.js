import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConstructDefinition } from '../src/core/constructDefinition.js';
import { parseAsciiStl, parseBinaryStl, parseMeshBuffer, parseObj, voxelizeMeshToConstruct } from '../src/editor/meshVoxelizer.js';

const CUBE_OBJ = `
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 4 8 5 1
`;

const TRIANGLE_STL = `
solid triangle
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
endsolid triangle
`;

test('OBJ meshes parse quads as triangulated faces', () => {
  const mesh = parseObj(CUBE_OBJ);
  assert.equal(mesh.sourceFormat, 'obj');
  assert.equal(mesh.vertices.length, 8);
  assert.equal(mesh.triangles.length, 12);
});

test('ASCII STL meshes parse vertex facets', () => {
  const mesh = parseAsciiStl(TRIANGLE_STL);
  assert.equal(mesh.sourceFormat, 'stl');
  assert.equal(mesh.vertices.length, 3);
  assert.equal(mesh.triangles.length, 1);
});

test('binary STL meshes parse vertex facets from file buffers', () => {
  const buffer = new ArrayBuffer(84 + 50);
  const view = new DataView(buffer);
  view.setUint32(80, 1, true);
  let offset = 84 + 12;
  for (const vertex of [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ]) {
    view.setFloat32(offset, vertex[0], true);
    view.setFloat32(offset + 4, vertex[1], true);
    view.setFloat32(offset + 8, vertex[2], true);
    offset += 12;
  }
  const parsedDirectly = parseBinaryStl(buffer);
  const parsedFromFile = parseMeshBuffer(buffer, 'triangle.stl');
  assert.equal(parsedDirectly.triangles.length, 1);
  assert.equal(parsedFromFile.vertices.length, 3);
});

test('mesh voxelizer emits valid layered construct JSON', () => {
  const construct = voxelizeMeshToConstruct(parseObj(CUBE_OBJ), {
    assetId: 'test.voxelized_cube',
    displayName: 'Voxelized Cube',
    span: 7,
    sampleDensity: 3,
  });
  const report = validateConstructDefinition(construct);
  assert.equal(report.valid, true);
  assert.equal(construct.cells.filter((cell) => cell.type === 'core').length, 1);
  assert.equal(construct.cells.some((cell) => cell.gridZ > 0), true);
  assert.equal(construct.connections.some((edge) => edge.aSide === 'above' && edge.bSide === 'below'), true);
  assert.equal(construct.voxelizer.sourceTriangles, 12);
});
