import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileSelectOptions } from '../src/ui/selectOptions.js';

function createSelect() {
  let replacementCount = 0;
  const select = {
    options: [],
    value: '',
    ownerDocument: {
      createElement() {
        return { value: '', textContent: '', dataset: {} };
      },
    },
    replaceChildren(...options) {
      this.options = options;
      replacementCount += 1;
    },
    get replacementCount() {
      return replacementCount;
    },
  };
  return select;
}

test('reconcileSelectOptions leaves an unchanged open-menu option list intact', () => {
  const select = createSelect();
  const descriptors = [
    { value: 'rocket', label: 'Rocket (3)', dataset: { icon: 'rocket' } },
    { value: 'mortar', label: 'Mortar (2)', dataset: { icon: 'mortar' } },
  ];

  assert.equal(reconcileSelectOptions(select, descriptors, 'mortar'), true);
  const originalOptions = select.options;
  assert.equal(select.value, 'mortar');

  assert.equal(reconcileSelectOptions(select, descriptors, 'mortar'), false);
  assert.equal(select.replacementCount, 1);
  assert.equal(select.options, originalOptions);
  assert.equal(select.value, 'mortar');
});

test('reconcileSelectOptions refreshes changed labels and preserves a valid selection', () => {
  const select = createSelect();
  reconcileSelectOptions(select, [
    { value: 'rocket', label: 'Rocket (3)' },
    { value: 'mortar', label: 'Mortar (2)' },
  ], 'mortar');

  assert.equal(reconcileSelectOptions(select, [
    { value: 'rocket', label: 'Rocket (4)' },
    { value: 'mortar', label: 'Mortar (2)' },
  ], 'mortar'), true);
  assert.equal(select.replacementCount, 2);
  assert.equal(select.value, 'mortar');
  assert.equal(select.options[0].textContent, 'Rocket (4)');
});

test('reconcileSelectOptions selects the first remaining option when selection disappears', () => {
  const select = createSelect();
  reconcileSelectOptions(select, [
    { value: 'rocket', label: 'Rocket' },
    { value: 'mortar', label: 'Mortar' },
  ], 'mortar');

  reconcileSelectOptions(select, [{ value: 'rocket', label: 'Rocket' }], 'mortar');
  assert.equal(select.value, 'rocket');
});
