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
    assetId: 'example.construct.inchworm_head_sculpted',
    displayName: 'Sculpted Inchworm Head Construct',
    tags: ['freedoms-pass', 'inchworm', 'head'],
    layers: [
      {
        z: 0,
        x0: -3,
        y0: -4,
        rows: [
          '.aa.aa.',
          'a.a.a.a',
          '.aaaaa.',
          'aaaaaaa',
          '.aaaaa.',
          '..aaa..',
          '...a...',
        ],
      },
      {
        z: 1,
        x0: -3,
        y0: -4,
        rows: [
          '..aaa..',
          '.agaga.',
          'aaaaaaa',
          'aaacaaa',
          'aaaaaaa',
          '.aaaaa.',
          '..aaa..',
        ],
      },
      {
        z: 2,
        x0: -3,
        y0: -4,
        rows: [
          '.......',
          '..aaa..',
          '.aaaaa.',
          'aaaaaaa',
          '.aaaaa.',
          '..aaa..',
          '.......',
        ],
      },
    ],
  },
  {
    assetId: 'example.construct.inchworm_body_segment_sculpted',
    displayName: 'Sculpted Inchworm Body Segment Construct',
    tags: ['freedoms-pass', 'inchworm', 'segment'],
    layers: [
      {
        z: 0,
        x0: -2,
        y0: -2,
        rows: [
          '..a..',
          '.aaa.',
          'aaaaa',
          '.aaa.',
          'a...a',
        ],
      },
      {
        z: 1,
        x0: -2,
        y0: -2,
        rows: [
          '.aaa.',
          'aaaaa',
          'aacaa',
          'aaaaa',
          '.aaa.',
        ],
      },
      {
        z: 2,
        x0: -2,
        y0: -2,
        rows: [
          '..g..',
          '.aaa.',
          'aaaaa',
          '.aaa.',
          '..a..',
        ],
      },
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
  for (const layer of shapeLayers(shape)) {
    for (let rowIndex = 0; rowIndex < layer.rows.length; rowIndex += 1) {
      const row = layer.rows[rowIndex];
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const mark = row[columnIndex];
        if (mark === '.') continue;
        const type = TYPE_FOR_MARK[mark];
        if (!type) throw new Error(`Unknown mark "${mark}" in ${shape.assetId}.`);
        const gridX = layer.x0 + columnIndex;
        const gridY = layer.y0 + rowIndex;
        const gridZ = layer.z;
        const role = roleFor(shape, type, gridX, gridY, gridZ);
        const cell = {
          id: `${role}_x${coordinateId(gridX)}_y${coordinateId(gridY)}${gridZ === 0 ? '' : `_z${coordinateId(gridZ)}`}`,
          type,
          gridX,
          gridY,
          role,
        };
        if (gridZ !== 0) cell.gridZ = gridZ;
        const metadata = metadataFor(shape, cell);
        if (metadata) Object.assign(cell, metadata);
        const appearance = appearanceFor(shape, cell);
        if (appearance) cell.appearance = appearance;
        if (byPosition.has(positionKey(gridX, gridY, gridZ))) throw new Error(`Duplicate cell at ${gridX},${gridY},${gridZ} in ${shape.assetId}.`);
        cells.push(cell);
        byPosition.set(positionKey(gridX, gridY, gridZ), cell);
      }
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
    presentation: presentationFor(shape),
    cells,
    connections: connectionTree(cells, byPosition),
    modules: [],
  };
}

function shapeLayers(shape) {
  return shape.layers ?? [{ z: 0, x0: shape.x0, y0: shape.y0, rows: shape.rows }];
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
    byPosition.get(positionKey(cell.gridX - 1, cell.gridY, cell.gridZ ?? 0)),
    byPosition.get(positionKey(cell.gridX + 1, cell.gridY, cell.gridZ ?? 0)),
    byPosition.get(positionKey(cell.gridX, cell.gridY - 1, cell.gridZ ?? 0)),
    byPosition.get(positionKey(cell.gridX, cell.gridY + 1, cell.gridZ ?? 0)),
    byPosition.get(positionKey(cell.gridX, cell.gridY, (cell.gridZ ?? 0) - 1)),
    byPosition.get(positionKey(cell.gridX, cell.gridY, (cell.gridZ ?? 0) + 1)),
  ].filter(Boolean);
}

function connectionBetween(a, b) {
  const dx = b.gridX - a.gridX;
  const dy = b.gridY - a.gridY;
  const dz = (b.gridZ ?? 0) - (a.gridZ ?? 0);
  const aSide =
    Math.abs(dz) > Math.max(Math.abs(dx), Math.abs(dy))
      ? dz >= 0
        ? 'above'
        : 'below'
      : Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0
          ? 'right'
          : 'left'
        : dy >= 0
          ? 'bottom'
          : 'top';
  const bSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right', above: 'below', below: 'above' }[aSide];
  return { a: a.id, b: b.id, aSide, bSide, type: 'structural' };
}

function roleFor(shape, type, gridX, gridY, gridZ = 0) {
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
  if (shape.assetId.includes('inchworm_head') && type === 'gun') return 'eyeGun';
  if (shape.assetId.includes('inchworm_head') && gridY <= -3 && gridZ === 0) return 'mandible';
  if (shape.assetId.includes('inchworm_head')) return 'headCarapace';
  if (shape.assetId.includes('inchworm_body_segment') && type === 'gun') return 'mothLaunchNode';
  if (shape.assetId.includes('inchworm_body_segment') && gridZ === 0 && gridY >= 2 && Math.abs(gridX) === 2) return 'nubbyLeg';
  if (shape.assetId.includes('inchworm_body_segment')) return 'bodySegment';
  if (shape.assetId.includes('moth') && type === 'gun') return 'blastNode';
  if (shape.assetId.includes('moth') && Math.abs(gridX) >= 1) return 'wing';
  return 'hull';
}

function appearanceFor(shape, cell) {
  if (shape.assetId.includes('inchworm_head') && cell.role === 'eyeGun' && cell.slot === 'leftEye') return { tint: '#ff2d1a', emissive: true, label: 'red eye' };
  if (shape.assetId.includes('inchworm_head') && cell.role === 'eyeGun' && cell.slot === 'rightEye') return { tint: '#ff8a1f', emissive: true, label: 'orange eye' };
  if (shape.assetId.includes('inchworm_head') && cell.role === 'mandible') return { tint: '#8ba866', label: 'pinser mandible' };
  if (shape.assetId.includes('inchworm_body_segment') && cell.role === 'mothLaunchNode') return { tint: '#d51f1f', emissive: true, label: 'moth launch node' };
  if (shape.assetId.includes('inchworm_body_segment') && cell.role === 'nubbyLeg') return { tint: '#3e4f2e', label: 'nubby leg' };
  return null;
}

function metadataFor(shape, cell) {
  if (shape.assetId.includes('inchworm_head') && cell.role === 'eyeGun') return { slot: cell.gridX < 0 ? 'leftEye' : 'rightEye' };
  if (shape.assetId.includes('inchworm_body_segment') && cell.role === 'core') return { role: 'segmentCore' };
  return null;
}

function presentationFor(shape) {
  if (shape.assetId.includes('inchworm_head')) {
    return { shape: 'roundedOrb', relativeScale: 1.25, notes: 'Compound enemy head: rounded shell, pinser-like mandibles, red/orange gun eyes.' };
  }
  if (shape.assetId.includes('inchworm_body_segment')) {
    return { shape: 'roundedOrb', relativeScale: 1, notes: 'Compound enemy segment: rounded shell, nubby legs, top moth launch node.' };
  }
  return undefined;
}

function positionKey(gridX, gridY, gridZ = 0) {
  return `${gridX},${gridY},${gridZ}`;
}

function coordinateId(value) {
  return value < 0 ? `n${Math.abs(value)}` : String(value);
}

function distanceSquared(a, b) {
  return (a.gridX - b.gridX) ** 2 + (a.gridY - b.gridY) ** 2 + ((a.gridZ ?? 0) - (b.gridZ ?? 0)) ** 2;
}
