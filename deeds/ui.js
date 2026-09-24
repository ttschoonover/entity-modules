// The deeds section of the page.
export default function render(api) {
  const { h, state, params, me, $, day } = api;
  const deeds = Object.values(state.m.deeds || {}).filter(d => !d.retired);
  const others = Object.values(state.participants).filter(p => p.status !== 'left' && p.id !== me?.id).map(p => p.id);
  const sec = h('section', {}, h('h2', {}, 'Deeds'), h('p', { class: 'hint' }, 'What the entity has registered, and who holds each.'));
  if (!deeds.length) sec.append(h('p', { class: 'hint' }, 'Nothing registered yet.'));
  const list = h('ul', { class: 'items' });
  for (const d of deeds) {
    const mine = me && d.holder === me.id;
    list.append(h('li', {}, h('h3', {}, d.title),
      h('p', { class: 'meta' }, `${d.id} · held by ${d.holder || 'the entity'} · registered ${day(d.granted)}`),
      d.description ? h('p', {}, d.description) : null,
      mine ? h('div', { class: 'buttons' },
        params.value('deeds.transferable') && others.length ? h('select', { id: `dd-${d.id}` }, others.map(id => h('option', { value: id }, id))) : null,
        params.value('deeds.transferable') && others.length ? h('button', { class: 'quiet', onclick: () => api.sign('deed.transfer', { deed: d.id, to: $(`#dd-${d.id}`).value }, `Passing ${d.title} to ${$(`#dd-${d.id}`).value}`) }, 'Pass on') : null,
        h('button', { class: 'quiet', onclick: () => api.sign('deed.release', { deed: d.id }, `Giving ${d.title} back to the entity`) }, 'Give back')) : null));
  }
  sec.append(list);
  if (me?.status !== 'active') return sec;
  sec.append(h('details', {}, h('summary', {}, 'Propose registering something'), h('div', { class: 'inline-form' },
    h('label', { for: 'dd-title' }, 'What it is'), h('input', { id: 'dd-title', placeholder: 'Room 3' }),
    h('label', { for: 'dd-id' }, 'Id'), h('input', { id: 'dd-id', placeholder: 'room-3' }),
    h('label', { for: 'dd-desc' }, 'Description'), h('textarea', { id: 'dd-desc', style: 'font-family:inherit' }),
    h('label', { for: 'dd-to' }, 'Held by'), h('select', { id: 'dd-to' }, h('option', { value: '' }, 'the entity'), Object.values(state.participants).filter(p => p.status !== 'left').map(p => h('option', { value: p.id }, p.id))),
    h('div', { class: 'buttons' }, h('button', { onclick: () => {
      const e = { kind: 'deed.grant', deed: $('#dd-id').value.trim(), title: $('#dd-title').value.trim(), description: $('#dd-desc').value.trim() || undefined, to: $('#dd-to').value || null };
      api.propose(`Register ${e.title}`, [e]);
    } }, 'Sign this proposal')))));
  return sec;
}
