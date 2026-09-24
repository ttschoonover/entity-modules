import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldWith, decide } from '../../test/helpers.js';

test('deeds: granted by decision, passed on, given back, retired', async () => {
  const w = await worldWith(['deeds']);
  const r = await decide(w, { title: 'Register the rooms', rule: 'ordinary', effects: [
    { kind: 'deed.grant', deed: 'room-3', title: 'Room 3', to: 'p-0002' },
    { kind: 'deed.grant', deed: 'cargo-bike', title: 'The cargo bike', to: null }] });
  assert.equal(r.enacted, true, r.refused?.[0]?.reason || r.notEnacted);
  assert.equal(w.state.m.deeds['room-3'].holder, 'p-0002');
  assert.equal(w.state.m.deeds['cargo-bike'].holder, null, 'held by the entity');
  const act = async (kind, by, f) => w.settle(await w.sign(kind, by, f));
  assert.match((await act('deed.transfer', 'p-0001', { deed: 'room-3', to: 'p-0003' })).refused[0].reason, /you do not hold room-3/);
  assert.equal((await act('deed.transfer', 'p-0002', { deed: 'room-3', to: 'p-0003' })).applied.length, 1);
  assert.equal((await act('deed.release', 'p-0003', { deed: 'room-3' })).applied.length, 1);
  assert.equal(w.state.m.deeds['room-3'].holder, null);
  assert.equal(w.state.m.deeds['room-3'].history.length, 3);
  await decide(w, { title: 'Bike to Ana', rule: 'ordinary', effects: [{ kind: 'deed.assign', deed: 'cargo-bike', to: 'p-0001' }] });
  await decide(w, { title: 'No passing on', rule: 'organic', changes: { 'deeds.transferable': false } });
  assert.match((await act('deed.transfer', 'p-0001', { deed: 'cargo-bike', to: 'p-0002' })).refused[0].reason, /only by decision/);
  const dup = await decide(w, { title: 'Again', rule: 'ordinary', effects: [{ kind: 'deed.grant', deed: 'room-3', title: 'Room 3' }] });
  assert.match(dup.refused[0].reason, /already exists/);
});
