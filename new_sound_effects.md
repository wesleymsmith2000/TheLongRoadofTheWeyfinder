I have added a lot of new sound effects to the sound assets. Lets wire them in:

- bullet_ricochet_# (#=1-4): use for glave bounce (always) and bullet impacts (25% chance)
-  buzzard_start_# (1-4): play one at random when a buzzard appears
- car_skidding_# (1-4): play when a car enemy stats skidding
-  harpoon_powerup: play when the player collects a harpoon powerup
- inchworm_defeated: play when the player destroys the head of an inchworm
- inchworm_segment_destroyed: play when the player destroys an inchworm segment
- insect_chittering_# (1-4): play one at random when an insectoid enemy appears (inchworm or moth)
- laser_scorch_pulsed_# (1-3): play one at random when a ground laser starts chaging
- laser_scorch_constant: loop as while a ground laser is firing and creating smoke areas
- metal_slash: play when a glave collides with a construct
- player_mortar_fire: play when the player's vehicle launches a mortar
- enemy_mortar_fire: play when an enemy fires a mortar
- enemy_beam_powerup: play when an enemy prepares starts charging up a beam to fire (layer over the scorch effect for ground beams)
- car_start_# (1-4): play one at random when any wheeled enemy construct appears (e.g. car, roadster, etc.)
- crash_and_jangle_# (1-4): play one at random as default sound when an enemy construct is destroyed
- crash_and_splash_# (1-4): play one at random when a water based construct (other than ocotpus) is defeated
- power_down_# (1-2): play one at random when a powerup ends its effect or when an enemy beam stops firing

Ambient sounds. Play them in chains of 1-10 at random intervals (picking new ones randomly as one ends while the chain is going) during appropriate levels. The mean interval between chains should be about 5 times the mean length of the sound file set being played from
- ocean_waves_# (1-4): during levels where water is present (DigitizedStream, PiratesRoad)
- night_forrest_#: during forrest or wooded levels (GhostForrestPathway, GhostForrestBanshee)
- rolling_thunder_#: play during levels where a storm is going (e.g. FreedomPass_StormsOfFatesShadow, FreedomPass_BossFight, ShadowedDesert_OminousStormfront, ShadowedDesert_BossFight)
- storm_wind_#: play during levels where there should be wind or approaching storms (all levels where rolling thunder is used plus ShadowedDesert_Journey_#, FreedomsPass_DarkeningSkies)
