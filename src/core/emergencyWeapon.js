import { firingGunLoadouts } from './arcadeLoadout.js';

export const EMERGENCY_PRIMARY_WEAPONS = ['main.basic', 'tracking_flechette', 'mortar', 'blade_launcher'];
export function functionalPrimaryCell(cell) {
  return Boolean(cell?.attached && !cell.state.destroyed && cell.state.deviceIntegrity > 0.15 &&
    cell.state.wiringIntegrity > 0.1 && cell.state.structureIntegrity > 0.1);
}

export function emergencyPrimaryState(game) {
  const configured = game.vehicleDefinition?.emergencyWeapon;
  const weaponId = configured === undefined ? 'main.basic' : configured;
  const cell = game.vehicle?.cells.find(cell => cell.type === 'core');
  const enabled = game.runMode === 'arcade' && !game.sandbox?.enabled && EMERGENCY_PRIMARY_WEAPONS.includes(weaponId);
  const cells = new Map((game.vehicle?.cells ?? []).map(cell => [cell.id, cell]));
  const normalPrimary = enabled && firingGunLoadouts(game).some(loadout =>
    loadout.primary.some(Boolean) && functionalPrimaryCell(cells.get(loadout.cellId)));
  return { cell, weaponId, enabled, active: enabled && functionalPrimaryCell(cell) && !normalPrimary };
}
