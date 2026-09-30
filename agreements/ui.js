// The agreements tab: the documents members must sign, their text, and who
// has signed which version.
import { current, fingerprint, signaturesOf, unsigned } from './index.js';

export default function render(api) {
  const { h, state, params, me, $, when, who, link } = api;
  const required = params.value('agreements.required');
  const sec = h('section', {}, h('h2', {}, 'Agreements'),
    h('p', { class: 'hint' }, required.length
      ? 'Every member signs these documents; nobody is admitted without having signed them. A signature records exactly which text was signed, and is kept for good.'
      : 'No document is required yet. The members can require one by setting agreements.required (Settings) to wiki pages.'));
  for (const id of required) {
    const v = current(state, id, params);
    if (!v) { sec.append(h('p', { class: 'flag' }, ...(state.m.wiki?.pages?.[id] ? [`"${id}" has not been enacted yet. Nobody can sign it, or be admitted, until the members enact it: `, link(`wiki/${id}`, 'open it on the Wiki')] : [`The required document "${id}" does not exist yet: write it on the Wiki tab.`]))); continue; }
    const page = state.m.wiki.pages[id];
    const mine = me ? unsigned(state, me.id, id, params) : 'not signed in';
    const people = state.order.map(pid => state.participants[pid]).filter(p => p.status === 'active' || p.status === 'applicant');
    sec.append(h('h3', {}, v.title),
      h('p', { class: 'meta' }, `version ${v.n}${page.statute ? `, enacted ${when(page.statute.at)}` : ', not yet enacted'} · `, link(`wiki/${id}/${v.n}`, 'open on the Wiki')),
      h('details', { open: me && mine ? true : null }, h('summary', {}, 'Read it'), h('div', { class: 'post-body wiki-body' }, v.body)),
      me && mine ? h('div', { class: 'grant' },
        h('label', { style: 'font-weight:400' }, h('input', { type: 'checkbox', id: `ag-${id}`, style: 'width:auto;margin-right:.5rem' }), `I have read version ${v.n} of "${v.title}" and I agree to it.`),
        h('div', { class: 'buttons' }, h('button', { onclick: () => {
          if (!$(`#ag-${id}`).checked) return alert('Tick the box to confirm you have read it and agree.');
          api.sign('agreement.sign', { page: id, version: v.n, text: fingerprint(id, v) }, `Your signature on "${v.title}", version ${v.n}`);
        } }, 'Sign'))) : me ? h('p', { class: 'state-carried' }, 'You have signed it.') : null,
      api.list({ key: `ag-${id}`, items: people, noun: 'members', head: ['Member', 'Status', 'Signed'],
        row: (p) => { const s = signaturesOf(state, p.id, id).slice(-1)[0]; const why = unsigned(state, p.id, id, params);
          return h('tr', {}, h('td', {}, who(p.id)), h('td', {}, p.status === 'applicant' ? 'applying' : 'member'),
            h('td', { class: why ? 'flag' : null }, s ? `version ${s.version}, ${when(s.at)}${why ? ' (not the current version)' : ''}` : 'not yet')); },
        pin: me ? (p) => p.id === me.id : null,
        filters: [{ label: 'Signed', options: [['Everyone', () => true], ['Not signed', (p) => !!unsigned(state, p.id, id, params)], ['Signed', (p) => !unsigned(state, p.id, id, params)]] }] }));
  }
  return sec;
}
