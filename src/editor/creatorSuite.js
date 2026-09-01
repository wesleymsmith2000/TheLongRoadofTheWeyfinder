import { installLocalContentBundle, installLocalContentFiles, listLocalContentPacks, removeLocalContentPack } from '../core/localContentLibrary.js';
import { EXAMPLE_PROTOTYPE0_MODULE_SET_BUNDLE } from './examplePrototype0ModuleSet.js';
import { EXAMPLE_ZONE_ENEMY_SET_BUNDLE } from './exampleZoneEnemySet.js';

const editorFrame = document.querySelector('#editorFrame');
const editorButtons = [...document.querySelectorAll('[data-editor]')];
const importFolderButton = document.querySelector('#importFolderButton');
const importFolderInput = document.querySelector('#importFolderInput');
const importFilesButton = document.querySelector('#importFilesButton');
const importFilesInput = document.querySelector('#importFilesInput');
const installExampleButton = document.querySelector('#installExampleButton');
const installZoneEnemyExampleButton = document.querySelector('#installZoneEnemyExampleButton');
const refreshModulesButton = document.querySelector('#refreshModulesButton');
const clearStatusButton = document.querySelector('#clearStatusButton');
const moduleStatus = document.querySelector('#moduleStatus');
const moduleList = document.querySelector('#moduleList');

for (const button of editorButtons) {
  button.addEventListener('click', () => openEditor(button));
}
importFolderButton.addEventListener('click', () => importFolderInput.click());
importFolderInput.addEventListener('change', () => importModuleFiles(importFolderInput));
importFilesButton.addEventListener('click', () => importFilesInput.click());
importFilesInput.addEventListener('change', () => importModuleFiles(importFilesInput));
installExampleButton.addEventListener('click', installExampleModuleSet);
installZoneEnemyExampleButton.addEventListener('click', installZoneEnemyExampleSet);
refreshModulesButton.addEventListener('click', () => renderModuleList());
clearStatusButton.addEventListener('click', () => {
  moduleStatus.textContent = '';
});

renderModuleList();

function openEditor(button) {
  for (const candidate of editorButtons) candidate.setAttribute('aria-pressed', String(candidate === button));
  editorFrame.src = button.dataset.editor;
}

async function importModuleFiles(input) {
  if (!input.files?.length) return;
  const result = await installLocalContentFiles(input.files, {
    packId: `local.creator_suite.${Date.now()}`,
    displayName: 'Creator Suite Import',
  });
  renderImportStatus(result);
  renderModuleList();
  input.value = '';
}

function installExampleModuleSet() {
  const result = installLocalContentBundle(EXAMPLE_PROTOTYPE0_MODULE_SET_BUNDLE);
  renderImportStatus(result);
  renderModuleList();
}

function installZoneEnemyExampleSet() {
  const result = installLocalContentBundle(EXAMPLE_ZONE_ENEMY_SET_BUNDLE);
  renderImportStatus(result);
  renderModuleList();
}

function renderImportStatus(result) {
  const lines = [];
  lines.push(`<strong>${result.ok ? 'Import installed' : 'Import failed'}</strong>`);
  for (const error of result.errors ?? []) lines.push(`<span class="error">Error: ${escapeHtml(error)}</span>`);
  for (const warning of result.warnings ?? []) lines.push(`<span class="warning">Warning: ${escapeHtml(warning)}</span>`);
  if (result.installedPacks?.length) lines.push(`<span>${escapeHtml(result.installedPacks.join(', '))}</span>`);
  moduleStatus.innerHTML = lines.join('<br />');
}

function renderModuleList() {
  const packs = listLocalContentPacks();
  if (packs.length === 0) {
    moduleList.innerHTML = '<span>No local packs installed in this browser.</span>';
    return;
  }
  moduleList.replaceChildren(
    ...packs.map((pack) => {
      const row = document.createElement('div');
      row.className = 'module-row';
      const counts = Object.entries(pack.assetCounts ?? {})
        .map(([kind, count]) => `${count} ${kind}`)
        .join(', ');
      row.innerHTML = `
        <strong>${escapeHtml(pack.displayName)}</strong>
        <span>${escapeHtml(pack.packId)}</span>
        <span>${escapeHtml(counts || 'no assets')}</span>
      `;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        removeLocalContentPack(pack.packId);
        renderModuleList();
      });
      row.append(remove);
      return row;
    }),
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
