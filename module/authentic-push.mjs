// Push to Sheets: items already sitting in the world or on actors were copied
// from the compendium when they were dragged over, so a compendium rebuild
// never reaches them. This pass brings their description fields in line with
// the current authentic text overrides (or back to shipped text when an
// override was cleared), matched by item type and name.
//
// Only description fields are touched: dots, XP, difficulty, cost and every
// other stat stay as they are. A field counts as safe to replace when it still
// holds the shipped text or the text a previous push wrote (tracked by hash in
// flags.vtm-v20.authenticPushed). Anything else is a hand edit and is left
// alone unless the GM ticks "overwrite custom edits".

import { DISCIPLINES, BACKGROUNDS, MERITS, FLAWS } from './compendiums.mjs';
import { PATHS } from './paths-data.mjs';
import { RITUALS } from './rituals-data.mjs';
import { getOverrides, applyAuthentic } from './authentic-store.mjs';

const FLAG_SCOPE = 'vtm-v20';
const FLAG_KEY = 'authenticPushed';

const hash = s => {
  let h = 0;
  for (const ch of String(s ?? '')) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;
  return (h >>> 0).toString(36);
};

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Flag keys can't hold dots, so field paths are stored with '|'.
const flagKey = path => path.replace(/\./g, '|');

function sourceFor(item) {
  const n = item.name;
  switch (item.type) {
    case 'discipline': return { kind: 'discipline', src: DISCIPLINES.find(d => d.name === n) };
    case 'path': return { kind: 'path', src: PATHS.find(p => p.name === n) };
    case 'background': return { kind: 'background', src: BACKGROUNDS.find(b => b.name === n) };
    case 'ritual': return { kind: 'ritual', src: RITUALS.find(r => r.name === n) };
    case 'merit': {
      // Flaws are merit items with a negative cost; check the likely list first.
      const flawFirst = Number(item.system?.cost) < 0;
      const f = FLAWS.find(x => x.name === n);
      const m = MERITS.find(x => x.name === n);
      if (flawFirst ? f : !m && f) return { kind: 'flaw', src: f };
      return { kind: 'merit', src: m };
    }
    default: return { kind: null, src: null };
  }
}

// Every description field the shipped item has, as { path: value }.
function fieldsOf(kind, data) {
  const out = {};
  if ('description' in (data.system || {})) out['system.description'] = data.system.description || '';
  if (kind === 'discipline' || kind === 'path') {
    for (const [k, p] of Object.entries(data.system?.powers || {})) {
      if (p && 'desc' in p) out[`system.powers.${k}.desc`] = p.desc || '';
    }
  } else if (kind === 'background') {
    for (const [k, l] of Object.entries(data.system?.levels || {})) {
      if (l && 'desc' in l) out[`system.levels.${k}.desc`] = l.desc || '';
    }
  }
  return out;
}

const fieldLabel = path => {
  if (path === 'system.description') return 'description';
  const m = path.match(/^system\.(powers|levels)\.([^.]+)\.desc$/);
  return m ? m[2] : path;
};

function planFor(item, ov, overwrite) {
  const { kind, src } = sourceFor(item);
  if (!src) return null;
  const target = applyAuthentic(kind, src, ov) || src;
  const shipped = fieldsOf(kind, src);
  const wanted = fieldsOf(kind, target);
  const pushed = item.flags?.[FLAG_SCOPE]?.[FLAG_KEY] || {};

  const upd = {};
  const newFlags = { ...pushed };
  const changed = [];
  const conflicts = [];
  for (const [path, want] of Object.entries(wanted)) {
    const current = foundry.utils.getProperty(item, path) ?? '';
    if (current === want) continue;
    const untouched = current === shipped[path] || pushed[flagKey(path)] === hash(current);
    if (!untouched && !overwrite) { conflicts.push(fieldLabel(path)); continue; }
    upd[path] = want;
    newFlags[flagKey(path)] = hash(want);
    changed.push(fieldLabel(path));
  }
  if (!changed.length && !conflicts.length) return null;
  if (changed.length) upd[`flags.${FLAG_SCOPE}.${FLAG_KEY}`] = newFlags;
  return { item, upd: changed.length ? upd : null, changed, conflicts };
}

export function computePushPlan({ overwrite = false } = {}) {
  const ov = getOverrides();
  const rows = [];
  const scan = (items, owner) => {
    for (const item of items) {
      const p = planFor(item, ov, overwrite);
      if (p) rows.push({ ...p, owner });
    }
  };
  scan(game.items, null);
  for (const actor of game.actors) scan(actor.items, actor);
  return {
    updates: rows.filter(r => r.upd),
    conflicts: rows.filter(r => r.conflicts.length),
  };
}

async function runPush(plan) {
  const worldUpdates = [];
  const byActor = new Map();
  for (const r of plan.updates) {
    const u = { _id: r.item.id, ...r.upd };
    if (r.owner) {
      if (!byActor.has(r.owner)) byActor.set(r.owner, []);
      byActor.get(r.owner).push(u);
    } else worldUpdates.push(u);
  }
  if (worldUpdates.length) await Item.updateDocuments(worldUpdates);
  for (const [actor, updates] of byActor) await actor.updateEmbeddedDocuments('Item', updates);
  return { items: plan.updates.length, actors: byActor.size };
}

// One line per actor (world items grouped too), item names only; the field
// detail is in a tooltip so the list stays short.
const rowList = (rows, pick) => {
  const groups = new Map();
  for (const r of rows) {
    const where = r.owner ? r.owner.name : 'World items';
    if (!groups.has(where)) groups.set(where, []);
    groups.get(where).push(r);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([where, list]) => {
      const items = list.map(r => `<span title="${esc(pick(r).join(', '))}">${esc(r.item.name)}</span>`).join(', ');
      return `<li><b>${esc(where)}</b>: ${items}</li>`;
    }).join('');
};

const BOX = 'max-height: 40vh; overflow-y: auto; margin: 4px 0 8px; padding: 4px 8px; border: 1px solid var(--vtm-border, #444); border-radius: 4px;';

export async function pushToSheets() {
  const safe = computePushPlan({ overwrite: false });
  const forced = computePushPlan({ overwrite: true });
  if (!forced.updates.length) {
    ui.notifications.info('Every item in the world already matches the current authentic text.');
    return;
  }
  const actorCount = new Set(safe.updates.filter(r => r.owner).map(r => r.owner.id)).size;
  const content = `
    <div class="atp-preview">
      <p>${safe.updates.length} item${safe.updates.length === 1 ? '' : 's'} will change
        (${actorCount} actor${actorCount === 1 ? '' : 's'}${safe.updates.some(r => !r.owner) ? ' plus world items' : ''}).
        Only description text is replaced; dots, XP and stats are untouched.
        Take a world backup first if this is your first push.</p>
      ${safe.updates.length ? `<details><summary>Show what will update</summary><ul style="${BOX}">${rowList(safe.updates, r => r.changed)}</ul></details>` : ''}
      ${safe.conflicts.length ? `<details><summary>Hand-edited, skipped unless you tick below (${safe.conflicts.length})</summary><ul style="${BOX}">${rowList(safe.conflicts, r => r.conflicts)}</ul></details>
      <label class="atp-overwrite"><input type="checkbox" name="overwrite"> Overwrite custom edits too</label>` : ''}
    </div>`;

  const overwrite = await foundry.applications.api.DialogV2.wait({
    window: { title: 'Push Authentic Text to Sheets' },
    position: { width: 560, height: 'auto' },
    content,
    buttons: [
      { action: 'push', label: 'Push', icon: 'fas fa-upload', default: true,
        callback: (_ev, button) => !!button.form?.elements?.overwrite?.checked },
      { action: 'cancel', label: 'Cancel', callback: () => null },
    ],
    rejectClose: false,
  });
  if (overwrite === null || overwrite === undefined) return;

  const plan = overwrite ? forced : safe;
  if (!plan.updates.length) {
    ui.notifications.info('Nothing to push without overwriting custom edits.');
    return;
  }
  const res = await runPush(plan);
  ui.notifications.info(`Pushed authentic text to ${res.items} item${res.items === 1 ? '' : 's'} on ${res.actors} actor${res.actors === 1 ? '' : 's'}.`);
}
