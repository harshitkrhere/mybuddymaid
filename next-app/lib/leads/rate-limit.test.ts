// Run: npx tsx --test lib/leads/rate-limit.test.ts
//
// The in-memory limiter /api/lead uses per address and per phone number, with an injected
// clock: the cap holds inside the window, hits age out, a refused hit does not extend the
// block, and pruning keeps the map from growing for the life of the instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindow } from './rate-limit';

test('allows up to the limit inside the window, then refuses until the oldest hit ages out', () => {
  let t = 1_000_000;
  const w = new SlidingWindow(3, 600_000, () => t);
  assert.deepEqual([w.allow('a'), w.allow('a'), w.allow('a'), w.allow('a')], [true, true, true, false]);
  assert.ok(w.allow('b'), 'keys are independent');
  t += 599_999;
  assert.ok(!w.allow('a'));
  t += 2;
  assert.ok(w.allow('a'), 'the oldest hit has left the window');
});

test('a refused hit is not counted, so retrying while blocked does not lengthen the block', () => {
  let t = 0;
  const w = new SlidingWindow(1, 1000, () => t);
  assert.ok(w.allow('x'));
  for (let i = 0; i < 50; i++) {
    t += 10;
    assert.ok(!w.allow('x'));
  }
  t = 1001;
  assert.ok(w.allow('x'));
});

test('prune drops keys with no hit inside the window', () => {
  let t = 0;
  const w = new SlidingWindow(5, 1000, () => t);
  w.allow('old');
  t = 500;
  w.allow('new');
  t = 1200;
  w.prune();
  assert.equal(w.size, 1);
});

test('forget withdraws the latest hit, so a refused insert does not block the retry', () => {
  const t = 0;
  const w = new SlidingWindow(1, 600_000, () => t);
  assert.ok(w.allow('9876543210'));
  assert.ok(!w.allow('9876543210'), 'the second attempt inside the window is normally refused');
  w.forget('9876543210');
  assert.ok(w.allow('9876543210'), 'after forget the retry is allowed');
  w.forget('never-seen');
  assert.equal(w.size, 1);
});
