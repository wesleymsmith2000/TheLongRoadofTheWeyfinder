import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { beginEncounter, activeEncounterView, chooseEncounterChoice, encounterPausePolicy } from '../src/core/encounterRuntime.js';
import { normalizeEncounterDefinition, validateEncounterDefinition } from '../src/core/encounterDefinition.js';

const FORK_ENCOUNTER = {
  schemaVersion: '0.1',
  assetId: 'encounter.test.fork',
  title: 'Fork in the Road',
  initialState: 'start',
  states: [
    {
      id: 'start',
      presentationMode: 'MODAL_CHOICE_PAUSED',
      pausePolicy: 'ENCOUNTER_HOLD',
      body: 'A lantern bobs in the fog.',
      prompt: 'Which road?',
      choices: [
        {
          id: 'left',
          label: 'Take the bridge',
          routeBranch: { branchId: 'bridge' },
          effects: [
            { type: 'setWorldFlag', flag: 'bridgeChosen', value: true },
            { type: 'giveResource', resource: 'scrap', amount: 5 },
          ],
          resolves: true,
        },
        {
          id: 'right',
          label: 'Follow the low path',
          toState: 'after',
        },
      ],
    },
    {
      id: 'after',
      presentationMode: 'MODAL_CHOICE_PAUSED',
      pausePolicy: 'ENCOUNTER_HOLD',
      body: 'The mist gives way.',
      choices: [{ id: 'done', label: 'Continue', resolves: true }],
    },
  ],
};

test('encounter definitions normalize handoff naming and validate forward state links', () => {
  const normalized = normalizeEncounterDefinition(FORK_ENCOUNTER);
  assert.equal(normalized.states[0].presentationMode, 'modalChoicePaused');
  assert.equal(normalized.states[0].pausePolicy, 'encounterHold');
  assert.equal(normalized.states[0].choices[1].nextState, 'after');

  const report = validateEncounterDefinition(FORK_ENCOUNTER);
  assert.equal(report.valid, true);
});

test('modal encounter choices apply effects once and resolve cleanly', () => {
  const game = createGame(1147, { encounters: [FORK_ENCOUNTER] });
  const instance = beginEncounter(game, 'encounter.test.fork');
  assert.equal(activeEncounterView(game).title, 'Fork in the Road');
  assert.equal(encounterPausePolicy(game).advanceVehicle, false);

  const result = chooseEncounterChoice(game, instance, 'left');
  assert.equal(result.ok, true);
  assert.equal(game.scrap, 5);
  assert.equal(game.encounters.worldFlags.bridgeChosen, true);
  assert.equal(game.road.selectedRouteBranchId, 'bridge');
  assert.equal(activeEncounterView(game), null);
});

test('encounter hold pauses traversal and resolves from confirm input', () => {
  const game = createGame(1147, { encounters: [FORK_ENCOUNTER] });
  beginEncounter(game, 'encounter.test.fork');
  const before = { x: game.road.x, y: game.road.y, heading: game.road.heading };

  stepGame(game, { x: 1, y: 1 }, 1 / 60);
  assert.equal(game.road.x, before.x);
  assert.equal(game.road.y, before.y);
  assert.equal(game.road.heading, before.heading);

  stepGame(game, { encounterChoiceDelta: 1, encounterConfirmPressed: true }, 1 / 60);
  assert.equal(activeEncounterView(game).stateId, 'after');
  stepGame(game, { encounterConfirmPressed: true }, 1 / 60);
  assert.equal(activeEncounterView(game), null);
});

test('sandbox encounter event starts an inline vignette', () => {
  const game = createGame(1147, {
    sandbox: {
      title: 'Choice Sandbox',
      spawns: [],
      events: [{ id: 'fork', type: 'encounter', at: 0, encounter: FORK_ENCOUNTER }],
    },
  });

  stepGame(game, {}, 1 / 60);
  assert.equal(activeEncounterView(game).definitionId, 'encounter.test.fork');
  assert.equal(game.sandbox.lastMessage, 'fork: encounter started.');
});
