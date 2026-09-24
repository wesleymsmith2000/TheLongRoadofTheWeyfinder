import { CREATOR_ASSET_HANDOFF_STORAGE_KEY } from './modTestBench.js';

export function queueEditorAssetHandoff(storage, handoff) {
  storage?.setItem(CREATOR_ASSET_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
}

export function consumeEditorAssetHandoff(acceptedKinds, options = {}) {
  const storage = options.storage ?? globalThis.sessionStorage;
  if (!storage) return null;
  try {
    const handoff = JSON.parse(storage.getItem(CREATOR_ASSET_HANDOFF_STORAGE_KEY) ?? 'null');
    if (!handoff || !acceptedKinds.includes(handoff.kind) || !handoff.definition) return null;
    storage.removeItem(CREATOR_ASSET_HANDOFF_STORAGE_KEY);
    return handoff;
  } catch {
    storage.removeItem(CREATOR_ASSET_HANDOFF_STORAGE_KEY);
    return null;
  }
}
