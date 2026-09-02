import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(repoRoot, 'content', 'examples', 'prototype0-zone-enemy-set', 'constructs');

const TYPE_FOR_MARK = Object.freeze({
  a: 'armor',
  c: 'core',
  e: 'engine',
  g: 'gun',
  w: 'wheel',
});

const SHAPES = [
  {
    assetId: 'example.construct.ghost_phaser_sculpted',
    displayName: 'Sculpted Ghost Phaser Construct',
    tags: ['ghost-forrest', 'ghost'],
    x0: -4,
    y0: -4,
    rows: [
      '....a....',
      '..aaaaa..',
      '.aagcgaa.',
      'aaaaaaaaa',
      '.aaaaaaa.',
      '..aaaaa..',
      '.a.....a.',
      'a.......a',
    ],
  },
  {
    assetId: 'example.construct.tractor_frog_sculpted',
    displayName: 'Sculpted Tractor Frog Construct',
    tags: ['digitized-stream', 'frog'],
    x0: -4,
    y0: -3,
    rows: [
      '...gg....',
      '..aaaa...',
      '.aacaaa..',
      'aaaaaaaa.',
      '.aaaaaa..',
      'wwa..aww.',
      'w.......w',
    ],
  },
  {
    assetId: 'example.construct.heavy_mortar_boat_sculpted',
    displayName: 'Sculpted Heavy Mortar Boat Construct',
    tags: ['pirates-road', 'boat', 'mortar'],
    x0: -3,
    y0: -6,
    rows: [
      '...g...',
      '..ggg..',
      '..aaa..',
      '.aaaaa.',
      'gaaaca g'.replace(' ', ''),
      '.aaaaa.',
      '..aaa..',
      '..aaa..',
      '...a...',
      '..e.e..',
    ],
  },
  {
    assetId: 'example.construct.spider_walker_sculpted',
    displayName: 'Sculpted Eight Leg Walker Construct',
    tags: ['walker', 'spider', 'starlight-road', 'twilight-crossroads'],
    x0: -4,
    y0: -3,
    rows: [
      'w...a...w',
      '.a.aaa.a.',
      '..waaaw..',
      'aaaacaaaa',
      '..waaaw..',
      '.a.aaa.a.',
      'w...g...w',
    ],
  },
  {
    assetId: 'example.construct.scrap_buzzard_sculpted',
    displayName: 'Sculpted Scrap Buzzard Construct',
    tags: ['shadowed-desert', 'buzzard'],
    x0: -4,
    y0: -3,
    rows: [
      'a.......a',
      'aa.....aa',
      'aaa...aaa',
      '.aaacaaa.',
      '..aagaa..',
      '..aa.aa..',
      '.a.e.e.a.',
    ],
  },
  {
    assetId: 'example.construct.inchworm_carrier_sculpted',
    displayName: 'Sculpted Inchworm Carrier Construct',
    tags: ['freedoms-pass', 'inchworm'],
    x0: -7,
    y0: -2,
    rows: [
      'gg.aa.aa.aa.aa',
      'aacaaaaaaaaaaa',
      'aaaaaaaaaaaaaa',
      '.a..a..a..a..',
    ],
  },
  {
    assetId: 'example.construct.moth_bomber_sculpted',
    displayName: 'Sculpted Moth Bomber Construct',
    tags: ['freedoms-pass', 'moth'],
    x0: -2,
    y0: -2,
    rows: [
      'a...a',
      'aa.aa',
      'aacaa',
      'aa.aa',
      'agaga',
    ],
  },
];

mkdirSync(outputRoot, { recursive: true });

for (const shape of SHAPES) {
  const definition = constructFromShape(shape);
  const path = join(outputRoot, `${shape.assetId}.json`);
  writeFileSync(path, `${JSON.stringify(definition, null, 2)}\n`);
  console.log(`${shape.assetId}: ${definition.cells.length} cells, ${definition.connections.length} connections`);
}

function constructFromShape(shape) {
  const cells = [];
  const byPosition = new Map();
  for (let rowIndex = 0; rowIndex < shape.rows.length; rowIndex += 1) {
    const row = shape.rows[rowIndex];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const mark = row[columnIndex];
      if (mark === '.') continue;
      const type = TYPE_FOR_MARK[mark];
      if (!type) throw new Error(`Unknown mark "${mark}" in ${shape.assetId}.`);
      const gridX = shape.x0 + columnIndex;
      const gridY = shape.y0 + rowIndex;
      const role = roleFor(shape, type, gridX, gridY);
      const cell = {
        id: `${role}_x${coordinateId(gridX)}_y${coordinateId(gridY)}`,
        type,
        gridX,
        gridY,
        role,
      };
      if (byPosition.has(positionKey(gridX, gridY))) throw new Error(`Duplicate cell at ${gridX},${gridY} in ${shape.assetId}.`);
      cells.push(cell);
      byPosition.set(positionKey(gridX, gridY), cell);
    }
  }

  if (cells.filter((cell) => cell.type === 'core').length !== 1) {
    throw new Error(`${shape.assetId} must have exactly one core cell.`);
  }

  return {
    schemaVersion: '0.1',
    assetId: shape.assetId,
    displayName: shape.displayName,
    author: 'Weyfinder editor thread',
    provenance: 'Sculpted enlarged enemy construct example authored for the v1.0.4 4x4-voxel cell pass.',
    canonStatus: 'COMMUNITY',
    tags: ['example', 'enemy', 'sculpted', ...shape.tags],
    cells,
    connections: connectionTree(cells, byPosition),
    modules: [],
  };
}

function connectionTree(cells, byPosition) {
  const core = cells.find((cell) => cell.type === 'core');
  const connected = new Set([core.id]);
  const pending = new Set(cells.filter((cell) => cell.id !== core.id).map((cell) => cell.id));
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const connections = [];

  while (pending.size > 0) {
    let linked = false;
    for (const id of [...pending]) {
      const cell = byId.get(id);
      const neighbor = adjacentNeighbors(cell, byPosition).find((candidate) => connected.has(candidate.id));
      if (!neighbor) continue;
      connections.push(connectionBetween(neighbor, cell));
      connected.add(id);
      pending.delete(id);
      linked = true;
    }
    if (linked) continue;

    const [id] = pending;
    const cell = byId.get(id);
    const nearest = [...connected].map((connectedId) => byId.get(connectedId)).sort((a, b) => distanceSquared(a, cell) - distanceSquared(b, cell))[0];
    connections.push(connectionBetween(nearest, cell));
    connected.add(id);
    pending.delete(id);
  }

  return connections;
}

function adjacentNeighbors(cell, byPosition) {
  return [
    byPosition.get(positionKey(cell.gridX - 1, cell.gridY)),
    byPosition.get(positionKey(cell.gridX + 1, cell.gridY)),
    byPosition.get(positionKey(cell.gridX, cell.gridY - 1)),
    byPosition.get(positionKey(cell.gridX, cell.gridY + 1)),
  ].filter(Boolean);
}

function connectionBetween(a, b) {
  const dx = b.gridX - a.gridX;
  const dy = b.gridY - a.gridY;
  const aSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
  const bSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[aSide];
  return { a: a.id, b: b.id, aSide, bSide, type: 'structural' };
}

function roleFor(shape, type, gridX, gridY) {
  if (type === 'core') return 'core';
  if (shape.assetId.includes('ghost') && type === 'gun') return 'eyeGun';
  if (shape.assetId.includes('frog') && type === 'gun') return 'eyeGun';
  if (shape.assetId.includes('frog') && type === 'wheel') return 'leg';
  if (shape.assetId.includes('walker') && type === 'wheel') return 'supportLeg';
  if (shape.assetId.includes('walker') && Math.abs(gridX) <= 2 && gridY <= 1) return 'elevatedBody';
  if (shape.assetId.includes('mortar') && type === 'gun' && gridY <= -5) return 'mortar';
  if (shape.assetId.includes('mortar') && type === 'gun') return 'broadsideGun';
  if (shape.assetId.includes('buzzard') && Math.abs(gridX) >= 2 && type === 'armor') return 'wing';
  if (shape.assetId.includes('buzzard') && type === 'engine') return 'talon';
  if (shape.assetId.includes('inchworm') && type === 'gun') return 'eyeGun';
  if (shape.assetId.includes('inchworm') && gridX <= -5) return 'head';
  if (shape.assetId.includes('inchworm')) return 'bodySegment';
  if (shape.assetId.includes('moth') && type === 'gun') return 'blastNode';
  if (shape.assetId.includes('moth') && Math.abs(gridX) >= 1) return 'wing';
  return 'hull';
}

function positionKey(gridX, gridY) {
  return `${gridX},${gridY}`;
}

function coordinateId(value) {
  return value < 0 ? `n${Math.abs(value)}` : String(value);
}

function distanceSquared(a, b) {
  return (a.gridX - b.gridX) ** 2 + (a.gridY - b.gridY) ** 2;
}
