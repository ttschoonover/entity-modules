// committees · bodies inside the entity: same record, same members, same law.
// A committee has its own roll (a subset of members, appointed like an office's
// holders) and its own rule for deciding among itself. It has no power of its
// own: it acts through authority grants (the authority module), and can be made
// the entity's electorate ("committee:ID") by decision.
//
// A committee decides by co-signature: an act of the committee takes effect
// once enough of its members have signed it. How many is its rule:
//   majority   more than half of its current members (the default)
//   all        every current member
//   N          at least N members (never more than it has)
//
// Created, filled, emptied and dissolved only by decision (or by a grant that
// allows it); a member may always leave a committee.

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const committee = (state, id) => state.m.committees?.[id];

export const members = (c, at) => (c && !c.dissolved ? c.members.filter(m => !m.until || m.until > at).map(m => m.id) : []);
export function isMember(state, id, who, at) { return members(committee(state, id), at).includes(who); }

// How many signatures the committee's rule asks for, with n members.
export function needed(rule, n) {
  if (rule === 'all') return n;
  if (rule === 'majority' || rule === undefined) return Math.floor(n / 2) + 1;
  return rule;
}
export const ruleWhy = (rule) => (rule === undefined || rule === 'majority' || rule === 'all' || (Number.isInteger(rule) && rule >= 1 && rule <= 50))
  ? null : 'a committee rule is "majority", "all" or a whole number from 1 to 50';

function install(r) {
  r.registerEffect({
    name: 'committee.create', module: 'committees',
    rule: (p) => p.value('committees.create_rule'),
    describe: (e) => `Create the committee "${e.title}"${e.seats ? ` (${e.seats} seats)` : ''}, deciding by ${e.needs ?? 'majority'}`,
    check(state, e) {
      if (!ID.test(e.committee || '')) return 'a committee id is 1–40 lowercase letters, digits and -';
      if (committee(state, e.committee)) return `the committee ${e.committee} already exists`;
      if (typeof e.title !== 'string' || !e.title.trim() || e.title.length > 80) return 'a committee needs a title of 1–80 characters';
      if (e.seats !== undefined && (!Number.isInteger(e.seats) || e.seats < 1 || e.seats > 200)) return 'seats, if given, is a whole number from 1 to 200';
      if (e.remit !== undefined && (typeof e.remit !== 'string' || e.remit.length > 2000)) return 'a remit is at most 2000 characters';
      return ruleWhy(e.needs);
    },
  });
  r.registerEffect({
    name: 'committee.appoint', module: 'committees',
    rule: (p) => p.value('committees.appoint_rule'),
    describe: (e) => `Appoint ${e.member} to the committee ${e.committee}`,
    check(state, e, p, at) {
      const c = committee(state, e.committee);
      if (!c || c.dissolved) return `there is no committee ${e.committee}`;
      if (state.participants[e.member]?.status !== 'active') return `${e.member} is not an active member`;
      const now = members(c, at);
      if (now.includes(e.member)) return `${e.member} is already on ${e.committee}`;
      if (c.seats && now.length >= c.seats) return `all ${c.seats} seats of ${e.committee} are filled`;
      return null;
    },
  });
  r.registerEffect({
    name: 'committee.remove', module: 'committees',
    rule: (p) => p.value('committees.appoint_rule'),
    describe: (e) => `Remove ${e.member} from the committee ${e.committee}`,
    check: (state, e, p, at) => (isMember(state, e.committee, e.member, at) ? null : `${e.member} is not on ${e.committee}`),
  });
  r.registerEffect({
    name: 'committee.dissolve', module: 'committees',
    rule: (p) => p.value('committees.create_rule'),
    describe: (e) => `Dissolve the committee ${e.committee}`,
    check: (state, e) => { const c = committee(state, e.committee); return !c || c.dissolved ? `there is no committee ${e.committee}` : null; },
  });

  const end = (state, id, who, at) => { for (const m of state.m.committees[id].members) if (m.id === who && (!m.until || m.until > at)) m.until = at; };
  r.registerRecord('committee.create', (state, rec) => {
    const e = rec.payload;
    state.m.committees = state.m.committees || {};
    state.m.committees[e.committee] = { id: e.committee, title: e.title, remit: e.remit || '', seats: e.seats || null, needs: e.needs ?? 'majority', members: [], created: rec.at, dissolved: null };
  });
  r.registerRecord('committee.appoint', (state, rec) => { state.m.committees[rec.payload.committee].members.push({ id: rec.payload.member, since: rec.at, until: null }); });
  r.registerRecord('committee.remove', (state, rec) => end(state, rec.payload.committee, rec.payload.member, rec.at));
  r.registerRecord('committee.dissolve', (state, rec) => {
    const c = state.m.committees[rec.payload.committee];
    for (const m of c.members) if (!m.until || m.until > rec.at) m.until = rec.at;
    c.dissolved = rec.at;
  });

  r.registerKind({
    name: 'committee.leave', module: 'committees',
    check: (state, act) => (isMember(state, act.committee, act.by, act.at) ? null : `you are not on ${act.committee}`),
    reduce(state, rec) { end(state, rec.payload.act.committee, rec.payload.act.by, rec.at); },
  });

  // decision.electorate "committee:ID": the committee's members decide the
  // entity's business, one vote each. Rule by a party, a council, a clique.
  r.registerElectorate({
    name: 'committee', module: 'committees',
    describe: (id) => `the members of the committee ${id}`,
    check: (state, id) => (!id ? 'name the committee: committee:ID' : !committee(state, id) || committee(state, id).dissolved ? `there is no committee ${id}` : null),
    roll: (state, id, p, at) => Object.fromEntries(members(committee(state, id), at).map(m => [m, 1])),
  });
}

export default { name: 'committees', core: '0.4', install, members, isMember, needed,
  parameterKeys: ['committees.create_rule', 'committees.appoint_rule'] };
