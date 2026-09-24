// threads · boards, posts, replies and votes.
//
// Deleting or hiding a post removes it from view. Its text stays in the record,
// which is never altered: nothing written here can be truly erased. Say so to
// anyone who posts.
//
// Moderation: holders of the office named in threads.moderator_office may hide
// posts (read from the offices module's state if it is enabled; this module does
// not depend on it). Without one, posts are hidden only by decision.

import { actId } from '../../kernel/signed.js';

const items = (state) => (state.m.threads = state.m.threads || { items: {}, order: [] }).items;
const item = (state, id) => state.m.threads?.items?.[id] || null;
const holdsOffice = (state, office, who, at) => {
  const o = office && state.m.offices?.[office];
  return !!o && !o.abolished && o.holders.some(h => h.id === who && (!h.until || h.until > at));
};
export const postId = (act) => (act.kind === 'post.create' ? 't-' : 'r-') + actId(act).slice(0, 12);
export const score = (it) => Object.values(it.votes).reduce((a, b) => a + b, 0);

function bodyWhy(body, params) {
  const max = params.value('threads.max_length');
  if (typeof body !== 'string' || !body.trim()) return 'write something';
  return body.length > max ? `at most ${max} characters` : null;
}
const activeOnly = (state, act) => state.participants[act.by].status === 'active' ? null : 'only active participants may post';

function install(r) {
  r.registerKind({
    name: 'post.create', module: 'threads',
    check(state, act, { params }) {
      const a = activeOnly(state, act); if (a) return a;
      if (!params.value('threads.boards').includes(act.board)) return `no board "${act.board}"; boards are ${params.value('threads.boards').join(', ')}`;
      if (typeof act.title !== 'string' || !act.title.trim() || act.title.length > 200) return 'a post needs a title of 1–200 characters';
      return bodyWhy(act.body, params);
    },
    reduce(state, rec) {
      const a = rec.payload.act, id = postId(a);
      items(state)[id] = { id, kind: 'post', board: a.board, title: a.title, body: a.body, by: a.by, at: rec.at, parent: null, root: id, edits: 0, deleted: null, hidden: null, votes: {}, replies: [] };
      state.m.threads.order.push(id);
    },
  });
  r.registerKind({
    name: 'post.reply', module: 'threads',
    check(state, act, { params }) {
      const a = activeOnly(state, act); if (a) return a;
      const to = item(state, act.to);
      if (!to) return `nothing to reply to at ${act.to}`;
      if (to.deleted || to.hidden) return 'that post has been removed';
      return bodyWhy(act.body, params);
    },
    reduce(state, rec) {
      const a = rec.payload.act, id = postId(a), to = item(state, a.to);
      items(state)[id] = { id, kind: 'reply', board: to.board, title: null, body: a.body, by: a.by, at: rec.at, parent: a.to, root: to.root, edits: 0, deleted: null, hidden: null, votes: {}, replies: [] };
      to.replies.push(id);
    },
  });
  r.registerKind({
    name: 'post.vote', module: 'threads',
    check(state, act) {
      const a = activeOnly(state, act); if (a) return a;
      if (!item(state, act.target)) return `nothing to vote on at ${act.target}`;
      return [1, 0, -1].includes(act.value) ? null : 'a vote is 1 (up), -1 (down) or 0 (withdraw)';
    },
    reduce(state, rec) {
      const a = rec.payload.act, it = item(state, a.target);
      if (a.value === 0) delete it.votes[a.by]; else it.votes[a.by] = a.value;
    },
  });
  r.registerKind({
    name: 'post.edit', module: 'threads',
    check(state, act, { params }) {
      const it = item(state, act.target);
      if (!it) return `nothing at ${act.target}`;
      if (it.by !== act.by) return 'only the author may edit';
      if (it.deleted || it.hidden) return 'that post has been removed';
      if (act.title !== undefined && (it.kind !== 'post' || typeof act.title !== 'string' || !act.title.trim() || act.title.length > 200)) return 'only a post has a title, of 1–200 characters';
      return bodyWhy(act.body, params);
    },
    reduce(state, rec) {
      const a = rec.payload.act, it = item(state, a.target);
      it.body = a.body; if (a.title !== undefined) it.title = a.title; it.edits++; it.edited = rec.at;
    },
  });
  r.registerKind({
    name: 'post.delete', module: 'threads',
    check(state, act) {
      const it = item(state, act.target);
      if (!it) return `nothing at ${act.target}`;
      if (it.by !== act.by) return 'only the author may delete';
      return it.deleted ? 'already deleted' : null;
    },
    reduce(state, rec) { item(state, rec.payload.act.target).deleted = rec.at; },
  });
  r.registerKind({
    name: 'post.hide', module: 'threads',
    check(state, act, { params }) {
      const it = item(state, act.target);
      if (!it) return `nothing at ${act.target}`;
      if (it.hidden) return 'already hidden';
      const office = params.value('threads.moderator_office');
      if (!office) return 'this entity has no moderator office; posts are hidden by decision';
      if (!holdsOffice(state, office, act.by, act.at)) return `only holders of the ${office} office may hide posts`;
      return typeof act.reason === 'string' && act.reason.trim() ? null : 'give a reason; it is published';
    },
    reduce(state, rec) { const a = rec.payload.act; item(state, a.target).hidden = { by: a.by, at: rec.at, reason: a.reason }; },
  });
  r.registerEffect({
    name: 'thread.hide', module: 'threads',
    rule: () => 'ordinary',
    describe: (e) => `Hide ${e.target}${e.reason ? ` (${e.reason})` : ''}`,
    check(state, e) {
      const it = item(state, e.target);
      if (!it) return `nothing at ${e.target}`;
      return it.hidden ? 'already hidden' : null;
    },
  });
  r.registerRecord('thread.hide', (state, rec) => { item(state, rec.payload.target).hidden = { by: rec.payload.proposal || `grant ${rec.payload.via}`, at: rec.at, reason: rec.payload.reason || '' }; });
}

export default { name: 'threads', install, postId, score, parameterKeys: ['threads.boards', 'threads.max_length', 'threads.moderator_office'] };
