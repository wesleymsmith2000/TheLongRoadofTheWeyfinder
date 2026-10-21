# Arcade runtime rules

The title screen's **Arcade Run** starts `runMode: 'arcade'` with a fixed vehicle and editable loadout. `createGame` and weapon-bay normalization accept legacy `'lite'` input and normalize it immediately. The starter asset is `arcade_starting_vehicle`; its JSON filename remains `lite_starting_vehicle.json`.

Arcade overrides live in simulation code. Normal and Sandbox retain their authored weapon balance and movement. No platform APIs are needed to test Arcade.

- The body faces the current road frame's local negative Y axis, including during road turns. Translation stays available; rotation input cannot change facing.
- Ordinary primary launches and Mini Beam aim along road-forward, independently of cursor, turret and compensated aim. Mortar keeps its selected/guided target and exact-target arc. The utility repulsor keeps threat-directed aiming and its original cadence.
- Tracking Flechettes launch forward, retain the delay and turn phase, and acquire the active enemy nearest to the moving player. Their steering ignores reticle and projectile proximity.
- Ordinary primary projectile launch velocity is axial. Backward and lateral player motion cannot slow or deflect launch. For base speed `v0` and nonnegative player speed `vp` along the firing axis, world speed is `vp + v0 * (0.5 + 0.5 * exp(-vp / v0))`. This is a spawn-only rule; subsequent homing, forces and ricochets remain free to alter velocity. Mortar's exact-target arc is exempt.
- Primary cooldowns double after upgrades, and impact/beam/blast damage doubles once. Utility weapons and secondaries retain their ordinary cooldowns and damage.
- Enemy projectile timers advance at half rate, including pattern emitters, boss arms, artillery, mines, missiles and special beams. Frog hop movement stays unchanged and fires on alternating hops. Enemy projectile impact and blast damage doubles once; ram and environmental damage remain unchanged.
- All explosive radii grow by 50% after upgrades, for both teams. Derived explosion visuals reuse the already scaled radius. Deflected shots retain their existing scaling.
- Blade Launcher launches at half speed with 125% collision radius and sprite size. Deflection upgrades start from a 33% base. Its 50% seeded ricochet roll is separate from retained damage (`ricochetFactor`), and only successful bounces count toward `maxRicochets`. A failed roll preserves trajectory and lifetime.
- Enemies recover toward a road-relative band 15–65% of road half-height ahead, aiming roughly 35% ahead when outside it. Recovery blends longitudinal steering and leaves lateral movement intact. Charges, dives, first side/behind entries, boss sweeps, stun, escape, anchored obstacles and linked body segments retain movement ownership. Recovery resumes after maneuvers; Moths orbit ahead between dives and Zeppelins recover between rearward flyovers.

Creator-facing `projectile.ricochetProbability` is optional, defaults to `1`, and accepts values from `0` to `1`. The same field is supported on emission and detonation payloads. See [creator extension fields](creator-extension-api.md).

`tests/arcadeMode.test.js` covers normalization, curved-road facing, primary direction/pacing, the launch-spacing floor, Blade statistics, Flechette targeting, both teams' explosions, special enemy timer paths, seeded ricochets and front recovery. Run `npm test` and `npm run build` for the complete checks.
