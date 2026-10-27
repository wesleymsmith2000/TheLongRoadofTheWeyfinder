import { createCooldownRing } from './cooldownRing.js';

export function createWeaponManifestView(container, { label, icon }) {
  let signature = '';
  const rings = new Map();
  return entries => {
    const next = JSON.stringify(entries.map(entry => [entry.key, entry.weaponId, entry.status, entry.standby, Math.round(entry.integrity * 100)]));
    if (next !== signature) {
      signature = next;
      rings.clear();
      const document = container.ownerDocument;
      const cards = entries.map(entry => {
        const card = document.createElement('div');
        card.className = `manifest-card manifest-${entry.status}`;
        card.setAttribute('role', 'listitem');
        const state = entry.status === 'lost' ? 'Lost / disabled' : entry.status === 'danger' ? 'At risk' : 'Good';
        const description = `${label(entry.weaponId)} — ${state} — ${entry.cellId} — ${Math.round(entry.integrity * 100)}% integrity`;
        card.title = description;
        card.setAttribute('aria-label', description);
        const art = document.createElement('span');
        art.className = 'manifest-art';
        art.append(icon(entry.weaponId));
        const name = document.createElement('span');
        name.className = 'manifest-name';
        name.textContent = label(entry.weaponId);
        art.append(name);
        card.append(art);
        if (entry.emergency) {
          const state = document.createElement('small');
          state.className = 'manifest-emergency-state';
          state.textContent = entry.status === 'lost' ? 'CORE · OFFLINE' : entry.standby ? 'CORE · STANDBY' : 'CORE · ACTIVE';
          card.append(state);
        }
        if (entry.status === 'lost') {
          const cross = document.createElement('span');
          cross.className = 'manifest-lost-cross';
          cross.setAttribute('aria-hidden', 'true');
          cross.textContent = '×';
          card.append(cross);
        }
        const ring = createCooldownRing(document);
        card.append(ring.element);
        rings.set(entry.key, ring);
        return card;
      });
      if (cards.length === 0) {
        const empty = document.createElement('span');
        empty.textContent = 'No systems installed';
        cards.push(empty);
      }
      container.replaceChildren(...cards);
    }
    for (const entry of entries) rings.get(entry.key)?.update(entry.status === 'lost' ? {} : entry.cooldown);
  };
}
