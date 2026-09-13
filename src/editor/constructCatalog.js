import basicTurretDefinition from '../../content/constructs/basic_turret.json' with { type: 'json' };
import startingVehicleDefinition from '../../content/constructs/starting_vehicle.json' with { type: 'json' };
import ghostPhaserConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json' with { type: 'json' };
import tractorFrogConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.tractor_frog_sculpted.json' with { type: 'json' };
import heavyMortarBoatConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.heavy_mortar_boat_sculpted.json' with { type: 'json' };
import weyfinderRoadCarConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.weyfinder_road_car_sculpted.json' with { type: 'json' };
import weyfinderRoadArmoredCarConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.weyfinder_road_armored_car_sculpted.json' with { type: 'json' };
import weyfinderRoadFlechetteRacerConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.weyfinder_road_flechette_racer_sculpted.json' with { type: 'json' };
import spiderWalkerConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spider_walker_sculpted.json' with { type: 'json' };
import spideryWalkerConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spidery_walker_sculpted.json' with { type: 'json' };
import burlyWalkerBossBodyConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.burly_walker_boss_body_sculpted.json' with { type: 'json' };
import rotatableBossCannonConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.rotatable_boss_cannon_sculpted.json' with { type: 'json' };
import zeppelinBossConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.zeppelin_boss_sculpted.json' with { type: 'json' };
import scrapBuzzardConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.scrap_buzzard_sculpted.json' with { type: 'json' };
import inchwormHeadConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_head_sculpted.json' with { type: 'json' };
import inchwormBodySegmentConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_body_segment_sculpted.json' with { type: 'json' };
import mothBomberConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json' with { type: 'json' };

export const BUILTIN_CONSTRUCT_DEFINITIONS = Object.freeze([
  basicTurretDefinition,
  startingVehicleDefinition,
  ghostPhaserConstruct,
  tractorFrogConstruct,
  heavyMortarBoatConstruct,
  weyfinderRoadCarConstruct,
  weyfinderRoadArmoredCarConstruct,
  weyfinderRoadFlechetteRacerConstruct,
  spiderWalkerConstruct,
  spideryWalkerConstruct,
  burlyWalkerBossBodyConstruct,
  rotatableBossCannonConstruct,
  zeppelinBossConstruct,
  scrapBuzzardConstruct,
  inchwormHeadConstruct,
  inchwormBodySegmentConstruct,
  mothBomberConstruct,
]);

export const BUILTIN_CONSTRUCT_BY_ID = new Map(BUILTIN_CONSTRUCT_DEFINITIONS.map((definition) => [definition.assetId, definition]));
