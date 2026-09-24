import {
  installLocalContentBundle,
  installLocalContentFiles,
  loadLocalContentLibrary,
  listLocalContentPacks,
  removeLocalContentPack,
} from '../core/localContentLibrary.js';
import { queueEditorAssetHandoff } from './editorAssetHandoff.js';
import { EXAMPLE_PROTOTYPE0_MODULE_SET_BUNDLE } from './examplePrototype0ModuleSet.js';
import { EXAMPLE_ZONE_ENEMY_SET_BUNDLE } from './exampleZoneEnemySet.js';
import {
  CREATOR_TEST_REQUEST_STORAGE_KEY,
  SANDBOX_DEFINITION_STORAGE_KEY,
  createCreatorTestRequest,
  createEditorAssetHandoff,
  createPackDependencyReport,
  createPortablePack,
  editorRouteForAsset,
  listPackAssets,
  validatePackEntry,
} from './modTestBench.js';
import { SOUND_EFFECT_RESOURCE_BUNDLE } from './soundEffectResourceSet.js';
import { bindBuildVersion } from './versionBadge.js';

const editorFrame = document.querySelector('#editorFrame');
const editorButtons = [...document.querySelectorAll('[data-editor]')];
const importFolderButton = document.querySelector('#importFolderButton');
const importFolderInput = document.querySelector('#importFolderInput');
const importFilesButton = document.querySelector('#importFilesButton');
const importFilesInput = document.querySelector('#importFilesInput');
const installExampleButton = document.querySelector('#installExampleButton');
const installZoneEnemyExampleButton = document.querySelector('#installZoneEnemyExampleButton');
const installSoundEffectsButton = document.querySelector('#installSoundEffectsButton');
const refreshModulesButton = document.querySelector('#refreshModulesButton');
const clearStatusButton = document.querySelector('#clearStatusButton');
const moduleStatus = document.querySelector('#moduleStatus');
const moduleList = document.querySelector('#moduleList');
const packSelect = document.querySelector('#packSelect');
const assetKindSelect = document.querySelector('#assetKindSelect');
const assetSearchInput = document.querySelector('#assetSearchInput');
const selectedAssetPanel = document.querySelector('#selectedAssetPanel');
const validationReport = document.querySelector('#validationReport');
const dependencyReport = document.querySelector('#dependencyReport');
const openAssetButton = document.querySelector('#openAssetButton');
const testAssetButton = document.querySelector('#testAssetButton');
const exportPackButton = document.querySelector('#exportPackButton');
const removePackButton = document.querySelector('#removePackButton');

let selectedPackId = '';
let selectedAssetKey = '';

bindBuildVersion();

for (const button of editorButtons) button.addEventListener('click', () => openEditor(button.dataset.editor));
importFolderButton.addEventListener('click', () => importFolderInput.click());
importFolderInput.addEventListener('change', () => importModuleFiles(importFolderInput));
importFilesButton.addEventListener('click', () => importFilesInput.click());
importFilesInput.addEventListener('change', () => importModuleFiles(importFilesInput));
installExampleButton.addEventListener('click', () => installBundle(EXAMPLE_PROTOTYPE0_MODULE_SET_BUNDLE));
installZoneEnemyExampleButton.addEventListener('click', () => installBundle(EXAMPLE_ZONE_ENEMY_SET_BUNDLE));
installSoundEffectsButton.addEventListener('click', () => installBundle(SOUND_EFFECT_RESOURCE_BUNDLE));
refreshModulesButton.addEventListener('click', renderTestBench);
clearStatusButton.addEventListener('click', () => { moduleStatus.textContent = ''; });
packSelect.addEventListener('change', () => {
  selectedPackId = packSelect.value;
  selectedAssetKey = '';
  renderTestBench();
});
assetKindSelect.addEventListener('change', renderAssetList);
assetSearchInput.addEventListener('input', renderAssetList);
openAssetButton.addEventListener('click', openSelectedAsset);
testAssetButton.addEventListener('click', testSelectedAsset);
exportPackButton.addEventListener('click', exportSelectedPack);
removePackButton.addEventListener('click', removeSelectedPack);

renderTestBench();

function openEditor(route) {
  for (const button of editorButtons) button.setAttribute('aria-pressed', String(button.dataset.editor === route));
  if (editorFrame.getAttribute('src') !== route) editorFrame.src = route;
}

async function importModuleFiles(input) {
  if (!input.files?.length) return;
  const result = await installLocalContentFiles(input.files, {
    packId: `local.creator_suite.${Date.now()}`,
    displayName: 'Creator Suite Import',
  });
  finishInstall(result);
  input.value = '';
}

function installBundle(bundle) {
  finishInstall(installLocalContentBundle(bundle));
}

function finishInstall(result) {
  renderImportStatus(result);
  if (result.installedPacks?.length) selectedPackId = result.installedPacks.at(-1);
  selectedAssetKey = '';
  renderTestBench();
}

function renderImportStatus(result) {
  const lines = [`<strong>${result.ok ? 'Import installed' : 'Import failed'}</strong>`];
  for (const error of result.errors ?? []) lines.push(`<span class="error">Error: ${escapeHtml(error)}</span>`);
  for (const warning of result.warnings ?? []) lines.push(`<span class="warning">Warning: ${escapeHtml(warning)}</span>`);
  if (result.installedPacks?.length) lines.push(`<span>${escapeHtml(result.installedPacks.join(', '))}</span>`);
  moduleStatus.innerHTML = lines.join('<br />');
}

function renderTestBench() {
  const packs = listLocalContentPacks().sort((left, right) => left.displayName.localeCompare(right.displayName));
  if (!packs.some((pack) => pack.packId === selectedPackId)) selectedPackId = packs[0]?.packId ?? '';
  packSelect.replaceChildren(
    new Option(packs.length ? 'Select installed pack' : 'No local packs installed', ''),
    ...packs.map((pack) => new Option(`${pack.displayName} (${pack.packId})`, pack.packId)),
  );
  packSelect.value = selectedPackId;

  const assets = currentAssets();
  const kinds = [...new Set(assets.map((asset) => asset.kind))].sort();
  const previousKind = assetKindSelect.value;
  assetKindSelect.replaceChildren(new Option('All asset types', ''), ...kinds.map((kind) => new Option(kindLabel(kind), kind)));
  if (kinds.includes(previousKind)) assetKindSelect.value = previousKind;
  if (!assets.some((asset) => asset.key === selectedAssetKey)) selectedAssetKey = assets[0]?.key ?? '';
  renderAssetList();
  renderReports();
}

function renderAssetList() {
  const search = assetSearchInput.value.trim().toLowerCase();
  const kind = assetKindSelect.value;
  const assets = currentAssets().filter((asset) => {
    if (kind && asset.kind !== kind) return false;
    if (!search) return true;
    return `${asset.displayName} ${asset.assetId} ${asset.kind}`.toLowerCase().includes(search);
  });
  if (assets.length === 0) {
    moduleList.innerHTML = `<span>${selectedPackId ? 'No assets match the current filter.' : 'Install or import a pack to begin.'}</span>`;
  } else {
    moduleList.replaceChildren(...assets.map(createAssetRow));
  }
  renderSelectedAsset();
}

function createAssetRow(asset) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'asset-row';
  button.setAttribute('aria-pressed', String(asset.key === selectedAssetKey));
  button.innerHTML = `<span class="asset-kind">${escapeHtml(kindLabel(asset.kind))}</span><strong>${escapeHtml(asset.displayName)}</strong><span>${escapeHtml(asset.assetId)}</span>`;
  button.addEventListener('click', () => {
    selectedAssetKey = asset.key;
    renderAssetList();
  });
  return button;
}

function renderSelectedAsset() {
  const asset = selectedAsset();
  if (!asset) {
    selectedAssetPanel.innerHTML = '<span>No asset selected.</span>';
  } else {
    selectedAssetPanel.innerHTML = `<span class="status-tag">INSTALLED LOCAL</span><strong>${escapeHtml(asset.displayName)}</strong><span>${escapeHtml(kindLabel(asset.kind))}: ${escapeHtml(asset.assetId)}</span>`;
  }
  const testable = ['enemy', 'level', 'encounter'].includes(asset?.kind);
  testAssetButton.disabled = !testable;
  testAssetButton.textContent = asset?.kind === 'enemy' ? 'Test Enemy' : asset?.kind === 'level' ? 'Test Level' : asset?.kind === 'encounter' ? 'Test Encounter' : 'Test in Sandbox';
  openAssetButton.disabled = !editorRouteForAsset(asset);
}

function renderReports() {
  const library = loadLocalContentLibrary();
  const entry = library.packs[selectedPackId];
  const validation = validatePackEntry(entry);
  validationReport.innerHTML = reportMarkup(
    validation.valid ? 'Pack is valid' : 'Pack needs changes',
    validation.errors,
    validation.warnings,
  );
  const dependencies = createPackDependencyReport(entry, library);
  dependencyReport.innerHTML = dependencies.length
    ? dependencies.map((dependency) => `<span><strong>${escapeHtml(dependency.status)}</strong> ${escapeHtml(dependency.key)}${dependency.required === false ? ' (optional)' : ''}</span>`).join('')
    : '<span>No declared or discovered dependencies.</span>';
  exportPackButton.disabled = !entry;
  removePackButton.disabled = !entry;
}

function reportMarkup(title, errors, warnings) {
  return [
    `<strong>${escapeHtml(title)}</strong>`,
    ...errors.map((error) => `<span class="error">${escapeHtml(error)}</span>`),
    ...warnings.map((warning) => `<span class="warning">${escapeHtml(warning)}</span>`),
  ].join('');
}

function openSelectedAsset() {
  const asset = selectedAsset();
  try {
    const handoff = createEditorAssetHandoff(asset);
    queueEditorAssetHandoff(sessionStorage, handoff);
    const route = editorRouteForAsset(asset);
    openEditor(route);
    editorFrame.src = route;
    moduleStatus.textContent = `Opened ${asset.displayName} in its matching editor.`;
  } catch (error) {
    moduleStatus.textContent = error.message;
  }
}

function testSelectedAsset() {
  const asset = selectedAsset();
  try {
    const request = createCreatorTestRequest(asset);
    localStorage.setItem(CREATOR_TEST_REQUEST_STORAGE_KEY, JSON.stringify(request));
    localStorage.setItem(SANDBOX_DEFINITION_STORAGE_KEY, JSON.stringify(request.sandboxDefinition));
    moduleStatus.textContent = `${asset.displayName} is queued in Sandbox. Use Run Script on the game page.`;
    window.open(new URL('../?creatorTest=prepared', window.location.href), '_blank', 'noopener');
  } catch (error) {
    moduleStatus.textContent = error.message;
  }
}

function exportSelectedPack() {
  const entry = loadLocalContentLibrary().packs[selectedPackId];
  try {
    const portablePack = createPortablePack(entry);
    downloadJson(portablePack, `${portablePack.packId}.portable-pack.json`);
    moduleStatus.textContent = `Exported ${portablePack.packId} as a reimportable single-file pack.`;
  } catch (error) {
    moduleStatus.textContent = error.message;
  }
}

function removeSelectedPack() {
  if (!selectedPackId) return;
  const removedId = selectedPackId;
  removeLocalContentPack(removedId);
  selectedPackId = '';
  selectedAssetKey = '';
  moduleStatus.textContent = `Removed ${removedId}.`;
  renderTestBench();
}

function currentAssets() {
  return listPackAssets(loadLocalContentLibrary().packs[selectedPackId]);
}

function selectedAsset() {
  return currentAssets().find((asset) => asset.key === selectedAssetKey) ?? null;
}

function downloadJson(value, filename) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function kindLabel(kind) {
  return String(kind ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
