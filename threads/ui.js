// The threads section of the page.
import { score } from './index.js';

export default function render(api) {
  const { h, state, params, me, when, $ } = api;
  const t = state.m.threads || { items: {}, order: [] };
  const boards = params.value('threads.boards');
  const board = api.board || boards[0];
  const office = params.value('threads.moderator_office');
  const at = state.head.at;
  const mod = me && office && state.m.offices?.[office]?.holders.some(x => x.id === me.id && (!x.until || x.until > at));
  const can = me?.status === 'active';

  function item(it, depth) {
    const removed = it.hidden ? `[hidden: ${it.hidden.reason}]` : it.deleted ? '[deleted by its author]' : null;
    const mine = me && it.by === me.id;
    const vote = (v) => api.sign('post.vote', { target: it.id, value: it.votes[me.id] === v ? 0 : v }, v > 0 ? 'Your upvote' : 'Your downvote');
    const el = h('div', { class: depth ? 'reply' : '' },
      it.title ? h('h3', {}, removed ? h('span', { class: 'removed' }, removed) : it.title) : null,
      h('p', { class: 'meta' }, h('span', { class: 'score' }, score(it)), ` · ${it.by} · ${when(it.at)}${it.edits ? ` · edited ${it.edits}×` : ''}`),
      removed && !it.title ? h('p', { class: 'removed' }, removed) : removed ? null : h('p', { class: 'post-body' }, it.body),
      can && !removed ? h('div', { class: 'buttons' },
        h('button', { class: it.votes[me.id] === 1 ? '' : 'quiet', onclick: () => vote(1) }, '▲'),
        h('button', { class: it.votes[me.id] === -1 ? '' : 'quiet', onclick: () => vote(-1) }, '▼'),
        h('button', { class: 'quiet', onclick: () => { const f = el.querySelector(':scope > .inline-form'); f.hidden = !f.hidden; } }, 'Reply'),
        mine ? h('button', { class: 'quiet', onclick: () => confirm('It disappears from view, but its text stays in the record forever.') && api.sign('post.delete', { target: it.id }, 'Deleting your post') }, 'Delete') : null,
        mod && !mine ? h('button', { class: 'danger', onclick: () => { const r = prompt('Reason (published):'); if (r) api.sign('post.hide', { target: it.id, reason: r }, 'Hiding a post'); } }, 'Hide') : null) : null,
      can && !removed ? h('div', { class: 'inline-form', hidden: true },
        h('textarea', { id: `re-${it.id}`, style: 'font-family:inherit' }),
        h('div', { class: 'buttons' }, h('button', { onclick: () => api.sign('post.reply', { to: it.id, body: $(`#re-${it.id}`).value }, 'Your reply') }, 'Sign reply'))) : null);
    for (const rid of it.replies) if (t.items[rid] && depth < 6) el.append(item(t.items[rid], depth + 1));
    return el;
  }

  const posts = t.order.map(id => t.items[id]).filter(p => p.board === board && !(p.deleted && !p.replies.length))
    .sort((a, b) => score(b) - score(a) || (a.at < b.at ? 1 : -1));
  const sec = h('section', {}, h('h2', {}, 'Threads'),
    boards.length > 1 ? h('div', { class: 'buttons' }, boards.map(b => h('button', { class: b === board ? '' : 'quiet', onclick: () => { api.board = b; sec.replaceWith(render(api)); } }, b))) : null,
    h('p', { class: 'fine' }, 'Everything posted stays in the record for good. Deleting or hiding a post removes it from view, not from the record.'));
  if (can) sec.append(h('details', {}, h('summary', {}, `New post in ${board}`), h('div', { class: 'inline-form' },
    h('label', { for: 'np-title' }, 'Title'), h('input', { id: 'np-title' }),
    h('label', { for: 'np-body' }, 'Text'), h('textarea', { id: 'np-body', style: 'font-family:inherit' }),
    h('div', { class: 'buttons' }, h('button', { onclick: () => api.sign('post.create', { board, title: $('#np-title').value.trim(), body: $('#np-body').value }, 'Your post') }, 'Sign post')))));
  if (!posts.length) sec.append(h('p', { class: 'hint' }, 'No posts here yet.'));
  const list = h('ul', { class: 'items' });
  for (const p of posts) list.append(h('li', {}, item(p, 0)));
  sec.append(list);
  return sec;
}
