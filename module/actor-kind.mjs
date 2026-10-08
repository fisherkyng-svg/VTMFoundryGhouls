// Actor-kind helpers (ghoul/revenant fork).
//
// Upstream checks `actor.type === 'vampire'` / `'mortal'` directly. Ghouls need the
// vampire *sheet* (blood pool, Disciplines, Virtues, Path) but a mortal *body*
// (V20: no bashing halving, firearms stay lethal, no Kindred aggravated/sunlight
// handling, no frenzy states). Every such check in the fork routes through here.

/** True undead: Kindred physiology, frenzy, sunlight, bite, torpor, generation. */
export const isKindred = (actor) => actor?.type === 'vampire';

/** Ghoul or revenant actor. */
export const isGhoul = (actor) => actor?.type === 'ghoul';

/** Has a blood pool and uses the vampire sheet layout (Disciplines, Virtues, Path). */
export const hasVitae = (actor) => isKindred(actor) || isGhoul(actor);

/** Living body: mortal damage rules (ghouls are mortal for damage in V20). */
export const isMortalBody = (actor) => actor?.type === 'mortal' || isGhoul(actor);

/** Fortitude dots on the actor, 0 if none. */
export const fortitudeLevel = (actor) =>
  Array.from(actor?.items ?? []).find(i => i.type === 'discipline' && i.name?.toLowerCase() === 'fortitude')?.system?.level || 0;

/**
 * Cannot roll soak at all against lethal damage.
 * Mortals never can; ghouls can only through Fortitude.
 */
export const cannotSoakLethal = (actor) =>
  actor?.type === 'mortal' || (isGhoul(actor) && fortitudeLevel(actor) === 0);

/** Stamina counts toward soaking this damage type (living bodies only soak bashing with it). */
export const staminaSoaks = (actor, dmgType) =>
  !isMortalBody(actor) || String(dmgType || '').toLowerCase() === 'bashing';
