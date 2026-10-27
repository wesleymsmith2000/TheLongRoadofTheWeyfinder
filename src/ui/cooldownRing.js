import { formatCooldown } from '../core/weaponCooldown.js';

export function createCooldownRing(document) {
  const element = document.createElement('span');
  element.className = 'cooldown-ring';
  element.hidden = true;
  const value = document.createElement('span');
  value.className = 'cooldown-value';
  const unit = document.createElement('small');
  element.append(value, unit);
  let lastText = '';
  return { element, update({ remaining = 0, duration = remaining } = {}) {
    element.hidden = !(remaining > 0);
    if (element.hidden) return;
    const text = formatCooldown(remaining);
    const description = `Cooldown ${text.value} ${text.unit}`;
    if (description !== lastText) {
      value.textContent = text.value;
      unit.textContent = text.unit;
      element.setAttribute('aria-label', description);
      lastText = description;
    }
    element.style.setProperty('--cooldown-progress', `${Math.min(1, remaining / Math.max(remaining, duration, 0.001)) * 100}%`);
  } };
}
