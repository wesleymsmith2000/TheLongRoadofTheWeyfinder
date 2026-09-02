import basicTurretDefinition from '../../content/constructs/basic_turret.json' with { type: 'json' };
import startingVehicleDefinition from '../../content/constructs/starting_vehicle.json' with { type: 'json' };
import ghostPhaserConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json' with { type: 'json' };
import tractorFrogConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.tractor_frog_sculpted.json' with { type: 'json' };
import heavyMortarBoatConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.heavy_mortar_boat_sculpted.json' with { type: 'json' };
import spiderWalkerConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spider_walker_sculpted.json' with { type: 'json' };
import scrapBuzzardConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.scrap_buzzard_sculpted.json' with { type: 'json' };
import inchwormCarrierConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_carrier_sculpted.json' with { type: 'json' };
import mothBomberConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json' with { type: 'json' };

export const BUILTIN_CONSTRUCT_DEFINITIONS = Object.freeze([
  basicTurretDefinition,
  startingVehicleDefinition,
  ghostPhaserConstruct,
  tractorFrogConstruct,
  heavyMortarBoatConstruct,
  spiderWalkerConstruct,
  scrapBuzzardConstruct,
  inchwormCarrierConstruct,
  mothBomberConstruct,
]);

export const BUILTIN_CONSTRUCT_BY_ID = new Map(BUILTIN_CONSTRUCT_DEFINITIONS.map((definition) => [definition.assetId, definition]));

