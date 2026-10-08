// Path of Enlightenment virtues (fork addition).
//
// Table rule: Conviction and Instinct start one dot lower than Conscience and
// Self-Control (0 instead of 1). Applied in two places:
//   • Character creation: a Conviction/Instinct virtue starts at 0 and the free dot is gone.
//   • On the sheet: switching Path drops a virtue by 1 when its label goes
//     Conscience -> Conviction or Self-Control -> Instinct, and gives the dot back
//     on the way back to Humanity. Labels are kept in sync with the chosen Path.
// World setting "Path virtues start one dot lower" turns all of this off.
import { VTM } from './config.mjs';
import { hasVitae } from './actor-kind.mjs';

const SETTING = 'pathVirtuesStartLower';
const PATH_VIRTUE = /^(conviction|instinct)$/i;

export function registerPathVirtueSettings() {
  game.settings.register('vtm-v20', SETTING, {
    name: 'Path virtues start one dot lower',
    hint: 'Conviction and Instinct start at 0 instead of 1. Changing a character to a Path lowers those virtues by 1; changing back to Humanity restores the dot.',
    scope: 'world', config: true, type: Boolean, default: true,
  });
}

export const pathVirtuesEnabled = () => {
  try { return game.settings.get('vtm-v20', SETTING) !== false; } catch { return true; }
};

/** Starting (free) dots for a virtue with this label. */
export const virtueBase = (label) => (pathVirtuesEnabled() && PATH_VIRTUE.test(String(label || '').trim())) ? 0 : 1;

const labelsFor = (actor, pathName) => {
  const info = VTM.paths[pathName] || VTM.paths['Humanity'];
  return { conscience: info.virtues.conscience, selfControl: info.virtues.selfControl };
};

export function registerPathVirtueHooks() {
  Hooks.on('preUpdateActor', (actor, changes) => {
    const newPath = foundry.utils.getProperty(changes, 'system.pathName');
    if (newPath === undefined || !hasVitae(actor)) return;
    const oldPath = actor.system.pathName || 'Humanity';
    if (newPath === oldPath) return;

    // Old labels: chargen may have stored explicit labels; otherwise derive from the old Path
    const oldLabels = actor.getFlag('vtm-v20', 'virtueLabels') || labelsFor(actor, oldPath);
    const newLabels = labelsFor(actor, newPath);
    foundry.utils.setProperty(changes, 'flags.vtm-v20.virtueLabels', { ...newLabels });

    if (!pathVirtuesEnabled()) return;
    for (const key of ['conscience', 'selfControl']) {
      const delta = virtueBase(newLabels[key]) - virtueBase(oldLabels[key]);   // -1, 0 or +1
      if (!delta) continue;
      const cur = foundry.utils.getProperty(changes, `system.virtues.${key}`) ?? actor.system.virtues?.[key] ?? 0;
      foundry.utils.setProperty(changes, `system.virtues.${key}`, Math.min(5, Math.max(0, cur + delta)));
    }
  });
}
