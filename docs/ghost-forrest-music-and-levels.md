# GhostForrest music, levels and Sandbox tests

Available from **v1.0.23.0**. Open the game, choose **Sandbox Run**, then use the SBOX panel.

## Test current Arcade levels

1. Set **Gameplay rules** to **Arcade**.
2. Set **Level** to `19` and click **Test Campaign Level** for GhostForrestPathway_1.
   Current GhostForrest levels are `19` Pathway 1, `20` Banshee boss 1, `21` Pathway 2,
   and `22` Banshee boss 2. These numbers change if tracks are inserted earlier in the playlist.
3. Use **Loadout** to set upgrade levels, repair the vehicle and refill ammo. Pause opens
   Workshop Loadout and the **Core emergency primary** selector.
4. For a specific enemy test, choose the enemy, count, frequency and Level, then **Run Quick**.
   Set **Music / zone preview** to a GhostForrest track to test scripted Ghost Diver flavor.
   Quick tests keep ambient waves off. **Test Campaign Level** includes the live scheduled
   and gap Divers, warnings and boss finale. Selecting another music preview does not change
   the campaign Level's enemy composition.

Changing rules applies on the next Run/Test. Starting a test creates a fresh vehicle.
Old Sandbox scripts default to Normal. Campaign previews retain Sandbox controls when
advancing levels and do not award account achievements or campaign boss clears.

## Build a GhostForrest level

Open `/tools/level-editor.html` on the same site as the game. Locally, run `npm run dev`
and open `http://127.0.0.1:5173/tools/level-editor.html` (use `npm.cmd` on PowerShell if
script execution policy blocks `npm`).

Start from [ghost_forrest_music_trial.json](../content/levels/ghost_forrest_music_trial.json):
paste it into the editor JSON area and click **Apply JSON**. Give each level its own
`assetId` and display name. Set **Music** to a bundled track name without `.mp3`, such
as `GhostForrestPathway_1`. Edit route segments and wave entries in JSON, Apply JSON,
then **Download JSON**. The editor preserves the music field when other controls change.

The sample uses three route segments totaling 3,600 world units. Road speed is 60 units/s
in Arcade and 30 in Normal, before dynamic changes; that is roughly 60/120 seconds of
base travel. For a musical phrase at time `t`, start with `atDistance = t * baseSpeed`.
For example, 25 seconds into Arcade is distance 1,500. `spacing` is distance between
repeated spawns; 180 is approximately three Arcade seconds. Boost, terrain and pacing
can change arrival timing, so tune by playtesting. For exact clock tests, use Sandbox
script `spawns[].at` and `interval` in seconds instead.

Import these three JSON files together in the game's **SBOX > Import Content JSON** field:

- Your level (or the sample above).
- [Ghost construct](../content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json).
- [Ghost firing pattern](../content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json).

Select the installed level, choose Normal or Arcade rules, and click **Play Custom Level**.
Leave **Music / zone preview** on **Default / level music** to hear the level's own track.
Import the edited files again to update the installed copy. Local packs live in that
browser's storage, so import them separately on your phone. Exported JSON is the shareable copy.

Custom-level Sandbox currently applies route, lighting, waves, obstacles and starting
music. It does not automatically execute level `triggers[]` for song changes or cues, or
generate a beat-synchronized level from an MP3. Its completion is armed when the authored
enemies/spawns/scrap clear; route length and song end do not gate completion. For a longer
listening session, set `completeOnEmpty: false` in the generated Sandbox script and **Run Script**.
Ghost constructs/patterns let you author wave geometry; use the canonical quick enemy
`ghost_phaser.ghost_forrest` to test its complete runtime phasing behavior directly.

## Add the new songs

The MP3s go under `assets/music/`. Keep the exact `GhostForrest` spelling in track keys.
For example, `GhostForrest_FaeLitHollow_1.mp3` becomes key `GhostForrest_FaeLitHollow_1`.
The FaeLitHollow files currently in the working folder still need this browser registration:

1. In `src/main.js`, import each MP3 beside the existing GhostForrest imports:

   ```js
   import faeLitHollow1Music from '../assets/music/GhostForrest_FaeLitHollow_1.mp3';
   ```

2. Add its key to `MUSIC_URLS` in that file:

   ```js
   GhostForrest_FaeLitHollow_1: faeLitHollow1Music,
   ```

   This also makes it appear in Sandbox's music picker. Extend `ambientKeysForTrack`'s
   GhostForrest matcher in that file if the new name needs forest ambience; its current
   matcher recognizes Pathway/Banshee names. The existing Diver zone matcher recognizes
   `GhostForrest` in new names. Check `enemyZoneRank` in `src/core/game.js` when adding a
   new naming family: its current rank list explicitly names Pathway and Banshee.

3. Copy the sample level for each song and set its `music` to the matching key.
   A track must be imported and mapped in `MUSIC_URLS` to play; JSON import alone does
   not add audio bytes. Keep the new MP3s and corresponding source imports in the same release.
4. For campaign placement, update `DEFAULT_LEVEL_MUSIC` in `src/core/levelMusic.js` and
   the reference `default_levels_music.md`. A new playlist entry currently creates a
   procedural campaign stage, using music names for zone selection and `BossFight`/`boss`
   for boss detection. It does **not** automatically load a custom level with a matching name.
   Authored-level campaign placement needs explicit runtime integration; test the authored
   JSON through Sandbox first.
5. Run `npm test` and `npm run build:pages`, update the visible build version, and deploy
   before phone testing. Verify the published version, because local files do not update Pages.

Choose the song order, target duration, wave timing and whether each track is a travel or
boss stage before changing the campaign playlist. The new music files are intentionally
not registered or inserted into the campaign by this Sandbox update.
