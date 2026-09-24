// deeds · a register of things and who holds them: a room, a bike, a domain
// name, a key to the workshop. A deed is granted by decision, to a participant
// or to the entity itself (holder: null). Its holder may pass it on, if the
// entity allows, or give it back.

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const reg = (state) => (state.m.deeds = state.m.deeds || {});
const alive = (state, id) => state.participants[id] && state.participants[id].status !== 'left';

function install(r) {
  r.registerEffect({
    name: 'deed.grant', module: 'deeds',
    rule: (p) => p.value('deeds.grant_rule'),
    describe: (e) => `Register "${e.title}" (${e.deed}) as held by ${e.to || 'the entity'}`,
    check(state, e) {
      if (!ID.test(e.deed || '')) return 'a deed id is 1–40 lowercase letters, digits and -';
      if (state.m.deeds?.[e.deed]) return `the deed ${e.deed} already exists`;
      if (typeof e.title !== 'string' || !e.title.trim() || e.title.length > 120) return 'a deed needs a title of 1–120 characters';
      if (e.description !== undefined && (typeof e.description !== 'string' || e.description.length > 2000)) return 'a description is at most 2000 characters';
      if (e.to !== undefined && e.to !== null && !alive(state, e.to)) return `${e.to} is not a participant`;
      return null;
    },
  });
  r.registerEffect({
    name: 'deed.assign', module: 'deeds',
    rule: (p) => p.value('deeds.grant_rule'),
    describe: (e) => `Assign ${e.deed} to ${e.to || 'the entity'}`,
    check(state, e) {
      const d = state.m.deeds?.[e.deed];
      if (!d || d.retired) return `there is no deed ${e.deed}`;
      if (e.to !== null && e.to !== undefined && !alive(state, e.to)) return `${e.to} is not a participant`;
      return null;
    },
  });
  r.registerEffect({
    name: 'deed.retire', module: 'deeds',
    rule: (p) => p.value('deeds.grant_rule'),
    describe: (e) => `Retire the deed ${e.deed}${e.reason ? ` (${e.reason})` : ''}`,
    check(state, e) { const d = state.m.deeds?.[e.deed]; return !d || d.retired ? `there is no deed ${e.deed}` : null; },
  });
  const move = (state, id, to, at, how) => { const d = reg(state)[id]; d.holder = to ?? null; d.history.push({ to: to ?? null, at, how }); };
  r.registerRecord('deed.grant', (state, rec) => {
    const e = rec.payload;
    reg(state)[e.deed] = { id: e.deed, title: e.title, description: e.description || '', holder: e.to ?? null, granted: rec.at, retired: null, history: [{ to: e.to ?? null, at: rec.at, how: `granted by ${e.proposal}` }] };
  });
  r.registerRecord('deed.assign', (state, rec) => move(state, rec.payload.deed, rec.payload.to, rec.at, `assigned by ${rec.payload.proposal}`));
  r.registerRecord('deed.retire', (state, rec) => { const d = reg(state)[rec.payload.deed]; d.retired = rec.at; d.holder = null; });

  r.registerKind({
    name: 'deed.transfer', module: 'deeds',
    check(state, act, { params }) {
      const d = state.m.deeds?.[act.deed];
      if (!d || d.retired) return `there is no deed ${act.deed}`;
      if (d.holder !== act.by) return `you do not hold ${act.deed}`;
      if (!params.value('deeds.transferable')) return 'deeds pass between participants only by decision here';
      if (act.to === act.by) return 'you already hold it';
      if (!alive(state, act.to)) return `${act.to} is not a participant`;
      return null;
    },
    reduce(state, rec) { const a = rec.payload.act; move(state, a.deed, a.to, rec.at, `passed on by ${a.by}`); },
  });
  r.registerKind({
    name: 'deed.release', module: 'deeds',
    check(state, act) {
      const d = state.m.deeds?.[act.deed];
      return !d || d.retired ? `there is no deed ${act.deed}` : d.holder !== act.by ? `you do not hold ${act.deed}` : null;
    },
    reduce(state, rec) { const a = rec.payload.act; move(state, a.deed, null, rec.at, `given back by ${a.by}`); },
  });
}

export default { name: 'deeds', install, parameterKeys: ['deeds.grant_rule', 'deeds.transferable'] };
