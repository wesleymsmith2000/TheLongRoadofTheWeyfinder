Lets make the between level repair screen a little more advanced and allow system upgrades.
Have the targeting AI work by moving the aiming reticle as if it were mouse or touch controled. Again, if mouse console or touch is in use, it should wait to a few seconds before taking over

For the main gun, lets make it fire slightly slower and do just a little less damage and add a stochastic angular (up to 10 degrees at first) offset to its firing. This provides upgrade routes which can scale geometrically, so each upgrade of a type costs about 25% more than the last one.
- Accuracy upgrade: reduce the maximum angular offset by 10% of current
- Fire rate: increase fire rate asymptotically to triple base speed
- damage: 10% increase to damage

For cannon: Cut base fire rate to be 50% slower. Reduce impact and blast damage by 50%, cut blast radius by 25%, cut blast damage by 50% then have ugrades below
-Ammo capacity +25% of base
-impact damage +10%
-blast damage +10%
-blast radius +10%
-shrapnel count +1
-shrapnel damage +10%
-knockback +5%
-fire rate +10%

For rocket: Add small blast radius, blast damage, and blast knockback like cannon, but at half the new cannon values. Make rockets start without any added velocity initially so they look like something dropped that accelerates toward the target that is nearest to the aiming reticle upgrades:
-Ammo capacity +25% of base
-impact damage +10%
-blast damage +10%
-blast radius +10%
-max velocity +10%
-turning radius 10% improvement
-knockback +5%
-fire rate +10%

For particle beam: Cut fire duration in half and beam width and damage rate in half. double heat production. Heat will asymptotically increase fire rate so at max heat time between shots would be infinite and at 0 heat time between shots is the base fire rate. Upgrades:
-Heat generation per fire frame: -10% (minimum of 1 heat unit)
-Heat sinked per down frame: +10%
-damage per frame: +10%
-beam pierce: +1 voxel
-max beam width: +1 voxel
-fire time: +10%
-fire rate: +10%

Make armor voxels 'degradeable' so they don't necessarily fall off after a single damage event but rather must soak some level of damage. Then provide upgrades:
-armor toughness: +10%
-armor regen module - same cost as replacing 10 lost armor modules. Repairs attached voxels to restore damage over time (cycle time = 1 unit per 50 frames)
--armor regen tenacity: can restore +1 voxel per regen cycle
--armor regen speed: cycle time reduced by 10%
--armor regen fecundity: +5% (multiplicative so it never hits exactly 100%) chance to restore 1 voxel lost from an attached armor module double chance if all other voxels are full strength
--armor regen accelerator: single buy that costs same as this module. can be toggled on or off and doubles cycle time at the cost of spending 4 scrap per missing voxel added and 1 scrap per voxel strength point restored.

Boosters should provide 50% less boost and cost 50% more to use and regen 50% slower. During a boost, player collision with enemies inflicts damage to the enemy and knock back. Damage and knockback should start out like a cannon hit. The player also takes 25% of that damage and knockback as recoil. During a boost impact damage from projectiles / weapons is reduced by 25%. Also, as long as the player holds the boost (double tap move then hold, hold joystick down, or hold boost button down) it will continue upt to about 5 frames at base. It will take a 20 frame base cooldown. Then add upgrades:
-booster acceleration: +10%
-booster max duration: +10%
-booster efficiency: +10%
-booster recharge rate: +10%
-booster charge capacity: +10%
-booster ram damage: +10%
-booster recoil damage dampening: +10%
-booster recoil knockback dampening: +10%
-booster damage shielding: +10%
-booster cooldown: 10%

for now, lets base upgrade costs at 25% of the module replacement cost to start.