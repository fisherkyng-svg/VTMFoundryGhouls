# Ghouls fork of Foundry-VTM-V20

A fork of [The Final Artificer's Foundry-VTM-V20](https://github.com/The-Final-Artificer/Foundry-VTM-V20) (MIT), based on upstream **v1.1.5**. It adds two things:

## 1. Ghoul / Revenant actor type

Create Actor → **Ghoul / Revenant**.

- **Sheet:** uses the vampire layout. That gives it the Advantages tab, Disciplines, Virtues, the Path selector, a blood pool, Heal with blood, and blood buffs.
- **Header:** has **Variety** (Ghoul / Revenant), **Family** (revenants only), **Domitor / Regnant**, and **Blood Pool Max** fields.
- **Limits:** 1 blood per turn, traits max 5. There's no generation, clan, Bite, Torpor box, frenzy, Rötschreck, or sunlight.
- **Damage works as for a mortal:**
  - Firearms stay lethal.
  - Bashing is not halved.
  - Daze threshold is Stamina.
  - There's no Kindred aggravated or sunlight prompt.
  - **Fortitude** is the exception. A ghoul with Fortitude soaks lethal damage with Fortitude dice only, plus armor. Without Fortitude, it can't soak lethal at all, same as a mortal.
  - Fortitude also soaks fire.
- **Revenants** show a reminder to regain 1 blood point each night. There's no automation for this.
- **Character creation:** the chargen wizard stays vampire-only. Build ghouls by hand.

All type checks route through `module/actor-kind.mjs`: `isKindred`, `hasVitae`, `isMortalBody`, `cannotSoakLethal`, `staminaSoaks`.

## 2. Path virtues start one dot lower

There's a world setting, **"Path virtues start one dot lower"**, on by default.

- **Chargen:** Conviction and Instinct start at 0 instead of 1, and the 7-dot pool counts from there. Switching a label back to Conscience or Self-Control returns the free dot.
- **Sheet:** changing the Path dropdown does two things:
  - Lowers a virtue by 1 (minimum 0) when its label goes from Conscience to Conviction or from Self-Control to Instinct.
  - Raises it back by 1 when you return to Humanity.

  The virtue labels stay in sync with the chosen Path. Moving from one Path to another changes nothing if the labels stay the same.

## Changed files

| File | Change |
|---|---|
| `module/actor-kind.mjs` | New: actor-kind helpers |
| `module/ghoul-data.mjs` | New: ghoul data model |
| `module/path-virtues.mjs` | New: Path virtue setting and hook |
| `module/vampire-sheet.mjs` | Ghoul routing |
| `module/combat.mjs` | Ghoul routing |
| `vtm-v20.mjs` | Ghoul registration |
| `template.json` | Ghoul registration |
| `lang/en.json` | Ghoul registration |
| `templates/vampire-sheet.hbs` | Ghoul header and status blocks |
| `module/chargen.mjs` | Path virtue base |
| `system.json` | Fork manifest |

## Merging upstream

```bash
git remote add upstream https://github.com/The-Final-Artificer/Foundry-VTM-V20.git
git fetch upstream
git merge upstream/main
grep -rn "type === 'vampire'\|type !== 'vampire'\|=== 'mortal'" module vtm-v20.mjs
```

The `grep` lists any new hard-coded type checks the merge brought in. Each one needs to route through the helpers.
