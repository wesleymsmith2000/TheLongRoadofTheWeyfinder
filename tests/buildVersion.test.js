import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILD_VERSION } from '../src/core/buildVersion.js';

test('build version tag follows visible Pages badge format', () => {
  assert.match(BUILD_VERSION, /^v\d+\.\d+\.\d+\.\d+$/);
});
