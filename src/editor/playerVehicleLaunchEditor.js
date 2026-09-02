import startingVehicleDefinition from '../../content/constructs/starting_vehicle.json' with { type: 'json' };
import { PLAYER_EQUIPMENT_TYPES } from '../core/playerAccount.js';
import {
  VEHICLE_EDITOR_GRID_RADIUS,
  addEditableVehicleCell,
  connectEditableVehicleCells,
  editableVehicleReport,
  normalizeGunLoadouts,
  removeEditableVehicleCell,
  setGunLoadoutSlot,
} from '../core/playerVehicleEditor.js';
import { availablePrimaryWeaponIds, availableSecondaryWeaponIds } from '../core/weaponLoadout.js';

const cellColors = {
  armor: '#8fa6ad',
  core: '#e4d66b',
  engine: '#6fe0bf',
  gun: '#d46e4f',
  wheel: '#9ca8ff',
};

export function createPlayerVehicleLaunchEditor(elements, options) {
  const context = elements.canvas.getContext('2d');
  const state = {
    definition: cloneDefinition(options.definition ?? options.account.savedVehicle ?? startingVehicleDefinition),
    account: options.account,
    tool: 'place',
    selectedCellId: null,
    message: '',
  };
  const gridCount = VEHICLE_EDITOR_GRID_RADIUS * 2 + 1;
  const pad = 22;
  const cellSize = (elements.canvas.width - pad * 2) / gridCount;
  const scrollContainer = elements.canvas.closest('.vehicle-editor-canvas-wrap');
  let shouldCenterScroll = true;

  for (const type of PLAYER_EQUIPMENT_TYPES) elements.partSelect.append(new Option(labelForType(type), type));
  bindTool(elements.placeButton, 'place');
  bindTool(elements.eraseButton, 'erase');
  bindTool(elements.connectButton, 'connect');
  populateLoadoutSelects();
  for (const select of elements.loadoutSelects ?? []) {
    select.addEventListener('change', () => {
      const result = setGunLoadoutSlot(
        state.definition,
        state.selectedCellId,
        select.dataset.slotKind,
        Number(select.dataset.slotIndex),
        select.value || null,
      );
      applyResult(result);
    });
  }
  elements.resetButton.addEventListener('click', () => {
    state.definition = cloneDefinition(startingVehicleDefinition);
    state.selectedCellId = null;
    state.message = 'Vehicle reset.';
    shouldCenterScroll = true;
    emitChange();
  });
  elements.canvas.addEventListener('click', handleClick);
  render();

  return {
    definition() {
      return cloneDefinition(state.definition);
    },
    setAccount(account) {
      state.account = account;
      populateLoadoutSelects();
      render();
    },
    reset() {
      state.definition = cloneDefinition(startingVehicleDefinition);
      state.selectedCellId = null;
      shouldCenterScroll = true;
      emitChange();
    },
  };

  function bindTool(button, tool) {
    button.addEventListener('click', () => {
      state.tool = tool;
      state.message = '';
      render();
    });
  }

  function handleClick(event) {
    const grid = eventToGrid(event);
    if (!grid) return;
    const cell = cellAt(grid.x, grid.y);
    if (state.tool === 'place') {
      if (cell?.type === 'gun') {
        state.selectedCellId = cell.id;
        state.message = `Selected ${cell.id}.`;
        render();
        return;
      }
      const result = addEditableVehicleCell(state.definition, state.account, elements.partSelect.value, grid.x, grid.y);
      if (result.changed && result.definition.cells.find((candidate) => candidate.gridX === grid.x && candidate.gridY === grid.y)?.type === 'gun') {
        state.selectedCellId = result.definition.cells.find((candidate) => candidate.gridX === grid.x && candidate.gridY === grid.y).id;
      }
      applyResult(result);
      return;
    }
    if (state.tool === 'erase') {
      applyResult(cell ? removeEditableVehicleCell(state.definition, cell.id) : { changed: false, reason: 'No cell at that grid position.' });
      return;
    }
    if (state.tool === 'connect') {
      if (!cell) {
        state.message = 'Choose an occupied cell.';
        render();
        return;
      }
      if (!state.selectedCellId || state.selectedCellId === cell.id) {
        state.selectedCellId = cell.id;
        state.message = `Selected ${cell.id}.`;
        render();
        return;
      }
      applyResult(connectEditableVehicleCells(state.definition, state.selectedCellId, cell.id));
      state.selectedCellId = cell.id;
    }
  }

  function applyResult(result) {
    state.message = result.reason ?? '';
    if (result.changed) {
      state.definition = result.definition;
      emitChange();
      return;
    }
    render();
  }

  function emitChange() {
    render();
    options.onChange?.(cloneDefinition(state.definition));
  }

  function render() {
    state.definition.gunLoadouts = normalizeGunLoadouts(state.definition);
    syncToolButtons();
    syncLoadoutControls();
    draw();
    renderStatus();
    centerScrollIfNeeded();
  }

  function syncToolButtons() {
    elements.placeButton.setAttribute('aria-pressed', String(state.tool === 'place'));
    elements.eraseButton.setAttribute('aria-pressed', String(state.tool === 'erase'));
    elements.connectButton.setAttribute('aria-pressed', String(state.tool === 'connect'));
  }

  function draw() {
    context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    context.fillStyle = '#0d1010';
    context.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
    drawGrid();
    drawConnections();
    for (const cell of state.definition.cells) drawCell(cell);
  }

  function drawGrid() {
    context.strokeStyle = 'rgb(244 238 228 / 0.09)';
    context.lineWidth = 1;
    for (let index = 0; index <= gridCount; index += 1) {
      const position = pad + index * cellSize;
      context.beginPath();
      context.moveTo(pad, position);
      context.lineTo(elements.canvas.width - pad, position);
      context.stroke();
      context.beginPath();
      context.moveTo(position, pad);
      context.lineTo(position, elements.canvas.height - pad);
      context.stroke();
    }
  }

  function drawConnections() {
    context.strokeStyle = '#f7c06a';
    context.lineWidth = 4;
    context.lineCap = 'round';
    for (const edge of state.definition.connections ?? []) {
      const a = state.definition.cells.find((cell) => cell.id === edge.a);
      const b = state.definition.cells.find((cell) => cell.id === edge.b);
      if (!a || !b) continue;
      const start = gridToCanvas(a.gridX, a.gridY);
      const end = gridToCanvas(b.gridX, b.gridY);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }

  function drawCell(cell) {
    const center = gridToCanvas(cell.gridX, cell.gridY);
    const size = cellSize - 8;
    context.fillStyle = cellColors[cell.type] ?? '#d7ceb8';
    context.strokeStyle = cell.id === state.selectedCellId ? '#ffffff' : 'rgb(0 0 0 / 0.45)';
    context.lineWidth = cell.id === state.selectedCellId ? 4 : 2;
    context.beginPath();
    context.roundRect(center.x - size / 2, center.y - size / 2, size, size, 7);
    context.fill();
    context.stroke();
    context.fillStyle = '#101313';
    context.font = '700 12px Inter, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(cell.type.toUpperCase().slice(0, 2), center.x, center.y);
    if (cell.type === 'gun') {
      const loadout = normalizeGunLoadouts(state.definition).find((candidate) => candidate.cellId === cell.id);
      const loadedCount = [...(loadout?.primary ?? []), ...(loadout?.secondary ?? [])].filter(Boolean).length;
      context.fillStyle = '#f4eee4';
      context.font = '700 10px Inter, sans-serif';
      context.fillText(String(loadedCount), center.x + size * 0.27, center.y + size * 0.27);
    }
  }

  function renderStatus() {
    const report = editableVehicleReport(state.definition, state.account);
    const usage = PLAYER_EQUIPMENT_TYPES.map((type) => `${labelForType(type)} ${report.usage[type].remaining}`).join(' | ');
    const lines = [
      `<span><strong>${report.valid ? 'Vehicle ready' : 'Vehicle needs changes'}</strong></span>`,
      `<span>${state.definition.cells.length} cells, ${(state.definition.connections ?? []).length} connections</span>`,
      `<span>${escapeHtml(usage)}</span>`,
    ];
    if (state.message) lines.push(`<span>${escapeHtml(state.message)}</span>`);
    const selectedLoadout = normalizeGunLoadouts(state.definition).find((loadout) => loadout.cellId === state.selectedCellId);
    if (selectedLoadout) {
      lines.push(`<span>Selected gun: ${escapeHtml([...selectedLoadout.primary, ...selectedLoadout.secondary].filter(Boolean).join(', ') || 'empty')}</span>`);
    }
    lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
    lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
    elements.status.innerHTML = lines.join('');
  }

  function eventToGrid(event) {
    const rect = elements.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * elements.canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * elements.canvas.height;
    if (x < pad || y < pad || x > elements.canvas.width - pad || y > elements.canvas.height - pad) return null;
    return {
      x: Math.floor((x - pad) / cellSize) - VEHICLE_EDITOR_GRID_RADIUS,
      y: Math.floor((y - pad) / cellSize) - VEHICLE_EDITOR_GRID_RADIUS,
    };
  }

  function gridToCanvas(gridX, gridY) {
    return {
      x: pad + (gridX + VEHICLE_EDITOR_GRID_RADIUS + 0.5) * cellSize,
      y: pad + (gridY + VEHICLE_EDITOR_GRID_RADIUS + 0.5) * cellSize,
    };
  }

  function cellAt(gridX, gridY) {
    return state.definition.cells.find((cell) => cell.gridX === gridX && cell.gridY === gridY);
  }

  function populateLoadoutSelects() {
    for (const select of elements.loadoutSelects ?? []) {
      const allowed = select.dataset.slotKind === 'primary' ? availablePrimaryWeaponIds(state.account) : availableSecondaryWeaponIds(state.account);
      const current = select.value;
      select.replaceChildren(new Option('None', ''));
      for (const id of allowed) select.append(new Option(labelForWeapon(id), id));
      if (current && !allowed.includes(current)) select.append(new Option(`${labelForWeapon(current)} (locked)`, current));
      select.value = current;
    }
  }

  function syncLoadoutControls() {
    const selectedCell = state.definition.cells.find((cell) => cell.id === state.selectedCellId);
    const selectedLoadout = normalizeGunLoadouts(state.definition).find((loadout) => loadout.cellId === state.selectedCellId);
    for (const select of elements.loadoutSelects ?? []) {
      const enabled = selectedCell?.type === 'gun' && selectedLoadout;
      select.disabled = !enabled;
      const value = enabled ? selectedLoadout[select.dataset.slotKind][Number(select.dataset.slotIndex)] ?? '' : '';
      if (value && ![...select.options].some((option) => option.value === value)) {
        select.append(new Option(`${labelForWeapon(value)} (locked)`, value));
      }
      select.value = value;
    }
  }

  function centerScrollIfNeeded() {
    if (!shouldCenterScroll || !scrollContainer) return;
    shouldCenterScroll = false;
    requestAnimationFrame(() => {
      scrollContainer.scrollLeft = Math.max(0, (scrollContainer.scrollWidth - scrollContainer.clientWidth) / 2);
      scrollContainer.scrollTop = Math.max(0, (scrollContainer.scrollHeight - scrollContainer.clientHeight) / 2);
    });
  }
}

function labelForType(type) {
  if (type === 'gun') return 'Gun';
  if (type === 'wheel') return 'Wheel';
  if (type === 'engine') return 'Engine';
  if (type === 'armor') return 'Armor';
  return type;
}

function labelForWeapon(id) {
  return id
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cloneDefinition(definition) {
  return JSON.parse(JSON.stringify(definition));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
