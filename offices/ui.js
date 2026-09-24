// The offices section of the page.
import { current } from './index.js';

export default function render(api) {
  const { h, state, me, when, $ } = api;
  const at = state.head.at;
  const all = Object.values(state.m.offices || {}).filter(o => !o.abolished);
  const active = Object.values(state.participants).filter(p => p.status === 'active').map(p => p.id);
  const sec = h('section', {}, h('h2', {}, 'Offices'));
  if (!all.length) sec.append(h('p', { class: 'hint' }, 'No offices yet.'));
  const list = h('ul', { class: 'items' });
  for (const o of all) {
    const now = current(o, at);
    list.append(h('li', {},
      h('h3', {}, o.title),
      h('p', { class: 'meta' }, `${o.id} · ${now.length} of ${o.seats} seat${o.seats === 1 ? '' : 's'} filled${o.term_days ? ` · ${o.term_days}-day terms` : ''}`),
      now.length ? h('ul', {}, now.map(x => h('li', {}, x.id, x.until ? ` · until ${when(x.until)}` : ''))) : h('p', { class: 'hint' }, 'Vacant.'),
      me && now.some(x => x.id === me.id)
        ? h('div', { class: 'buttons' }, h('button', { class: 'quiet', onclick: () => api.sign('office.resign', { office: o.id }, `Your resignation as ${o.title}`) }, 'Resign'))
        : null));
  }
  sec.append(list);
  if (me?.status !== 'active') return sec;
  sec.append(h('details', {}, h('summary', {}, 'Propose a new office'),
    h('div', { class: 'inline-form' },
      h('label', { for: 'of-title' }, 'Title'), h('input', { id: 'of-title', placeholder: 'Treasurer' }),
      h('label', { for: 'of-id' }, 'Id'), h('input', { id: 'of-id', placeholder: 'treasurer' }),
      h('label', { for: 'of-seats' }, 'Seats'), h('input', { id: 'of-seats', type: 'number', min: 1, max: 50, value: 1 }),
      h('label', { for: 'of-term' }, 'Term in days (empty: no end)'), h('input', { id: 'of-term', type: 'number', min: 1 }),
      h('div', { class: 'buttons' }, h('button', { onclick: () => {
        const e = { kind: 'office.create', office: $('#of-id').value.trim(), title: $('#of-title').value.trim(), seats: Number($('#of-seats').value) };
        if ($('#of-term').value) e.term_days = Number($('#of-term').value);
        api.propose(`Create the office of ${e.title}`, [e]);
      } }, 'Sign this proposal')))));
  if (all.length) {
    sec.append(h('details', {}, h('summary', {}, 'Propose an appointment or a removal'),
      h('div', { class: 'inline-form' },
        h('label', { for: 'of-which' }, 'Office'), h('select', { id: 'of-which' }, all.map(o => h('option', { value: o.id }, o.title))),
        h('label', { for: 'of-who' }, 'Person'), h('select', { id: 'of-who' }, active.map(id => h('option', { value: id }, id))),
        h('div', { class: 'buttons' },
          h('button', { onclick: () => api.propose(`Appoint ${$('#of-who').value} as ${$('#of-which').selectedOptions[0].text}`, [{ kind: 'office.fill', office: $('#of-which').value, holder: $('#of-who').value }]) }, 'Propose appointing'),
          h('button', { class: 'quiet', onclick: () => api.propose(`Remove ${$('#of-who').value} as ${$('#of-which').selectedOptions[0].text}`, [{ kind: 'office.vacate', office: $('#of-which').value, holder: $('#of-who').value }]) }, 'Propose removing')))));
  }
  return sec;
}
