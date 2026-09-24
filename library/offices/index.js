// offices · named offices with seats and terms. Created, filled, vacated and
// abolished only by decision; a holder may always resign.
//
// Terms end by date. "Now" is the time of whatever act is being checked, never
// a clock, so every copy reaches the same answer.

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const DAY = 86400000;
const addDays = (at, d) => new Date(Date.parse(at) + d * DAY).toISOString();

export const current = (office, at) => (office?.holders || []).filter(h => !h.until || h.until > at);
export function holds(state, officeId, who, at) {
  const o = state.m.offices?.[officeId];
  return !!o && !o.abolished && current(o, at).some(h => h.id === who);
}

function install(r) {
  const office = (state, id) => state.m.offices?.[id];

  r.registerEffect({
    name: 'office.create', module: 'offices',
    rule: (p) => p.value('offices.create_rule'),
    describe: (e) => `Create the office "${e.title}" (${e.seats} seat${e.seats === 1 ? '' : 's'}${e.term_days ? `, ${e.term_days}-day terms` : ''})`,
    check(state, e) {
      if (!ID.test(e.office || '')) return 'an office id is 1–40 lowercase letters, digits and -';
      if (office(state, e.office)) return `the office ${e.office} already exists`;
      if (typeof e.title !== 'string' || !e.title.trim() || e.title.length > 80) return 'an office needs a title of 1–80 characters';
      if (!Number.isInteger(e.seats) || e.seats < 1 || e.seats > 50) return 'seats must be a whole number from 1 to 50';
      if (e.term_days !== undefined && (!Number.isInteger(e.term_days) || e.term_days < 1)) return 'term_days must be a whole number of days';
      return null;
    },
  });
  r.registerEffect({
    name: 'office.fill', module: 'offices',
    rule: (p) => p.value('offices.fill_rule'),
    describe: (e) => `Appoint ${e.holder} to ${e.office}`,
    check(state, e, p, at) {
      const o = office(state, e.office);
      if (!o || o.abolished) return `there is no office ${e.office}`;
      if (state.participants[e.holder]?.status !== 'active') return `${e.holder} is not an active participant`;
      const now = current(o, at);
      if (now.some(h => h.id === e.holder)) return `${e.holder} already holds ${e.office}`;
      if (now.length >= o.seats) return `all ${o.seats} seat(s) of ${e.office} are filled; vacate one first`;
      const limit = p.value('offices.term_limit');
      if (limit > 0 && o.holders.filter(h => h.id === e.holder).length >= limit) return `${e.holder} has served the limit of ${limit} term(s)`;
      return null;
    },
  });
  r.registerEffect({
    name: 'office.vacate', module: 'offices',
    rule: (p) => p.value('offices.fill_rule'),
    describe: (e) => `Remove ${e.holder} from ${e.office}`,
    check(state, e, p, at) {
      return holds(state, e.office, e.holder, at) ? null : `${e.holder} does not hold ${e.office}`;
    },
  });
  r.registerEffect({
    name: 'office.abolish', module: 'offices',
    rule: (p) => p.value('offices.create_rule'),
    describe: (e) => `Abolish the office ${e.office}`,
    check(state, e) { const o = office(state, e.office); return !o || o.abolished ? `there is no office ${e.office}` : null; },
  });

  const end = (state, id, who, at) => {
    for (const h of state.m.offices[id].holders) if (h.id === who && (!h.until || h.until > at)) h.until = at;
  };
  r.registerRecord('office.create', (state, rec) => {
    const e = rec.payload;
    state.m.offices = state.m.offices || {};
    state.m.offices[e.office] = { id: e.office, title: e.title, seats: e.seats, term_days: e.term_days || null, holders: [], created: rec.at, abolished: null };
  });
  r.registerRecord('office.fill', (state, rec) => {
    const e = rec.payload, o = state.m.offices[e.office];
    o.holders.push({ id: e.holder, since: rec.at, until: o.term_days ? addDays(rec.at, o.term_days) : null });
  });
  r.registerRecord('office.vacate', (state, rec) => end(state, rec.payload.office, rec.payload.holder, rec.at));
  r.registerRecord('office.abolish', (state, rec) => {
    const o = state.m.offices[rec.payload.office];
    for (const h of o.holders) if (!h.until || h.until > rec.at) h.until = rec.at;
    o.abolished = rec.at;
  });

  // decision.electorate "office:ID": the office's current holders decide, one
  // vote each. A council, a board, a party's central committee, a sole ruler.
  r.registerElectorate({
    name: 'office', module: 'offices',
    describe: (id) => `the holders of the office ${id}`,
    check: (state, id) => (!id ? 'name the office: office:ID' : !office(state, id) || office(state, id).abolished ? `there is no office ${id}` : null),
    roll: (state, id, p, at) => Object.fromEntries(current(office(state, id), at).map(h => [h.id, 1])),
  });

  r.registerKind({
    name: 'office.resign', module: 'offices',
    check(state, act) { return holds(state, act.office, act.by, act.at) ? null : `you do not hold ${act.office}`; },
    reduce(state, rec) { end(state, rec.payload.act.office, rec.payload.act.by, rec.at); },
  });
}

export default { name: 'offices', core: '0.4', install, holds, current, parameterKeys: ['offices.create_rule', 'offices.fill_rule', 'offices.term_limit'] };
