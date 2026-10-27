export function createWeaponManifestView(container, { label, icon }) {
  let signature = '';
  return entries => {
    const next = JSON.stringify(entries.map(entry => [entry.key, entry.weaponId, entry.status, Math.round(entry.integrity * 100)]));
    if (next === signature) return;
    signature = next;
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
      if (entry.status === 'lost') {
        const cross = document.createElement('span');
        cross.className = 'manifest-lost-cross';
        cross.setAttribute('aria-hidden', 'true');
        cross.textContent = '×';
        card.append(cross);
      }
      return card;
    });
    if (cards.length === 0) {
      const empty = document.createElement('span');
      empty.textContent = 'No systems installed';
      cards.push(empty);
    }
    container.replaceChildren(...cards);
  };
}
