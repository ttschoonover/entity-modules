// badges · marks of recognition, shown beside names: founding member, first
// treasurer, 100 hours volunteered. Created, awarded and revoked by decision, or
// by an office or committee granted the power (authority). A member may always
// give back a badge of their own.

import { originOf } from '../../kernel/effects.js';

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const badge = (state, id) => state.m.badges?.[id] || null;
export const holds = (state, id, who) => !!badge(state, id)?.holders[who];
export const badgesOf = (state, who) => Object.values(state.m.badges || {}).filter(b => !b.retired && b.holders[who]);

function install(r) {
  r.registerEffect({
    name: 'badge.create', module: 'badges',
    rule: (p) => p.value('badges.rule'),
    describe: (e) => `Create the badge "${e.title}"`,
    check(state, e) {
      if (!ID.test(e.badge || '')) return 'a badge id is 1–40 lowercase letters, digits and -';
      if (badge(state, e.badge)) return `the badge ${e.badge} already exists`;
      if (typeof e.title !== 'string' || !e.title.trim() || e.title.length > 60) return 'a badge needs a title of 1–60 characters';
      if (e.description !== undefined && (typeof e.description !== 'string' || e.description.length > 500)) return 'a description is at most 500 characters';
      return null;
    },
  });
  r.registerEffect({
    name: 'badge.award', module: 'badges',
    rule: (p) => p.value('badges.rule'),
    describe: (e) => `Award the badge ${e.badge} to ${e.to}${e.note ? ` (${e.note})` : ''}`,
    check(state, e) {
      const b = badge(state, e.badge);
      if (!b || b.retired) return `there is no badge ${e.badge}`;
      if (!['active', 'applicant'].includes(state.participants[e.to]?.status)) return `${e.to} is not a member`;
      if (b.holders[e.to]) return `${e.to} already holds ${e.badge}`;
      return e.note !== undefined && (typeof e.note !== 'string' || e.note.length > 300) ? 'a note is at most 300 characters' : null;
    },
  });
  r.registerEffect({
    name: 'badge.revoke', module: 'badges',
    rule: (p) => p.value('badges.rule'),
    describe: (e) => `Take the badge ${e.badge} from ${e.from}${e.reason ? ` (${e.reason})` : ''}`,
    check: (state, e) => (holds(state, e.badge, e.from) ? null : `${e.from} does not hold ${e.badge}`),
  });
  r.registerEffect({
    name: 'badge.retire', module: 'badges',
    rule: (p) => p.value('badges.rule'),
    describe: (e) => `Retire the badge ${e.badge}`,
    check: (state, e) => { const b = badge(state, e.badge); return !b || b.retired ? `there is no badge ${e.badge}` : null; },
  });
  r.registerRecord('badge.create', (state, rec) => {
    const e = rec.payload;
    state.m.badges = state.m.badges || {};
    state.m.badges[e.badge] = { id: e.badge, title: e.title, description: e.description || '', created: rec.at, retired: null, holders: {}, history: [] };
  });
  r.registerRecord('badge.award', (state, rec) => {
    const e = rec.payload, b = badge(state, e.badge);
    b.holders[e.to] = { since: rec.at, note: e.note || '', by: originOf(e) };
    b.history.push({ at: rec.at, to: e.to, how: `awarded by ${originOf(e)}` });
  });
  r.registerRecord('badge.revoke', (state, rec) => {
    const e = rec.payload, b = badge(state, e.badge);
    delete b.holders[e.from];
    b.history.push({ at: rec.at, from: e.from, how: `revoked by ${originOf(e)}${e.reason ? `: ${e.reason}` : ''}` });
  });
  r.registerRecord('badge.retire', (state, rec) => { badge(state, rec.payload.badge).retired = rec.at; });

  r.registerKind({
    name: 'badge.return', module: 'badges',
    check: (state, act) => (holds(state, act.badge, act.by) ? null : `you do not hold ${act.badge}`),
    reduce(state, rec) {
      const a = rec.payload.act, b = badge(state, a.badge);
      delete b.holders[a.by];
      b.history.push({ at: rec.at, from: a.by, how: 'given back' });
    },
  });
}

export default { name: 'badges', core: '0.4', install, holds, badgesOf, parameterKeys: ['badges.rule'] };
