import test from 'node:test';
import assert from 'node:assert/strict';
import moonlitBeaconEncounter from '../content/encounters/moonlit_beacon_choice_vignette.json' with { type: 'json' };
import { ENCOUNTER_EFFECT_TYPES, validateEncounterDefinition } from '../src/core/encounterDefinition.js';

test('moonlit beacon encounter validates as a choice vignette asset', () => {
  const report = validateEncounterDefinition(moonlitBeaconEncounter);

  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
  assert.equal(moonlitBeaconEncounter.states.some((state) => state.presentationMode === 'modalChoicePaused'), true);
  assert.equal(moonlitBeaconEncounter.states.some((state) => state.presentationMode === 'worldHoldInteraction'), true);
  assert.equal(moonlitBeaconEncounter.repercussions[0].trigger.type, 'after_route_distance');
});

test('encounter validation rejects unknown effect verbs and missing route branches', () => {
  const report = validateEncounterDefinition({
    ...moonlitBeaconEncounter,
    states: [
      {
        id: 'start',
        presentationMode: 'MODAL_CHOICE_PAUSED',
        pausePolicy: 'FULL_PAUSE',
        choices: [
          {
            id: 'bad',
            label: 'Bad choice',
            effects: [{ type: 'notARealVerb' }, { type: 'selectRouteBranch' }],
          },
        ],
      },
    ],
    initialState: 'start',
  });

  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes(`one of: ${ENCOUNTER_EFFECT_TYPES.join(', ')}`)), true);
  assert.equal(report.errors.some((error) => error.includes('branchId is required')), true);
});

test('encounter validation accepts state maps for runtime importer flexibility', () => {
  const report = validateEncounterDefinition({
    ...moonlitBeaconEncounter,
    initialState: 'start',
    states: {
      start: {
        presentationMode: 'MODAL_CHOICE_PAUSED',
        pausePolicy: 'FULL_PAUSE',
        choices: [{ id: 'continue', label: 'Continue', resolves: true }],
      },
    },
    interactions: [],
    repercussions: [],
  });

  assert.equal(report.valid, true);
});
