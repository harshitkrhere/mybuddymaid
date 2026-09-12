// Run: npx tsx --test lib/support/contact.test.ts
//
// The name and number a handoff waits for, in the ways people actually type them. A number that
// is not an Indian mobile is refused rather than stored; a message with no number in it is not
// contact details, whatever else it says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisePhone, findPhone, formatPhone, cleanName, parseContactMessage, contactLine } from './contact';

test('normalisePhone: an Indian mobile in any common spelling becomes E.164; anything else is null', () => {
  for (const s of ['9691982400', '+91 96919 82400', '+919691982400', '919691982400', '09691982400', '0091 9691982400', '96919-82400', '(+91) 96919.82400', ' 96919 82400 ']) {
    assert.equal(normalisePhone(s), '+919691982400', JSON.stringify(s));
  }
  for (const s of ['5691982400', '969198240', '96919824001', '110028', '', '   ', 'call me', '+44 7700 900123', '1234567890', null, undefined]) {
    assert.equal(normalisePhone(s), null, JSON.stringify(s));
  }
});

test('findPhone: the first Indian mobile in free text, and nothing that merely has digits', () => {
  assert.equal(findPhone('name - harshit , phone - 9691982400'), '+919691982400');
  assert.equal(findPhone('mera number +91 98765 43210 hai'), '+919876543210');
  assert.equal(findPhone('pincode 110028'), null);
  assert.equal(findPhone('order 123456789012'), null, 'a twelve-digit run is not a phone');
  assert.equal(findPhone('what does gold cost'), null);
});

test('formatPhone: +91 XXXXX XXXXX', () => {
  assert.equal(formatPhone('+919691982400'), '+91 96919 82400');
  assert.equal(formatPhone('unexpected'), 'unexpected');
});

test('cleanName: capitalised, trimmed, stripped of anything that is not a name; null when nothing is left', () => {
  assert.equal(cleanName('harshit'), 'Harshit');
  assert.equal(cleanName('  harshit   kumar '), 'Harshit Kumar');
  assert.equal(cleanName("d'souza"), "D'Souza");
  assert.equal(cleanName('प्रिया'), 'प्रिया');
  assert.equal(cleanName('9691982400'), null);
  assert.equal(cleanName('x'), null);
  assert.equal(cleanName('a'.repeat(61)), null);
  assert.equal(cleanName(null), null);
  assert.equal(cleanName(''), null);
  const marked = cleanName('<b>Harshit</b>') ?? '';
  assert.ok(!/[<>/]/.test(marked), 'markup never survives');
  assert.ok(marked.includes('Harshit'));
});

test('parseContactMessage: a number with or without a name, in the ways people type it', () => {
  assert.deepEqual(parseContactMessage('name - harshit , phone - 9691982400'), { phone: '+919691982400', name: 'Harshit', attempted: true });
  assert.deepEqual(parseContactMessage('Harshit Kumar 9691982400'), { phone: '+919691982400', name: 'Harshit Kumar', attempted: true });
  assert.deepEqual(parseContactMessage('9691982400'), { phone: '+919691982400', name: null, attempted: true });
  assert.deepEqual(parseContactMessage('call me on +91 96919 82400'), { phone: '+919691982400', name: null, attempted: true });
  assert.deepEqual(parseContactMessage('mera naam priya hai, number 9876543210'), { phone: '+919876543210', name: 'Priya', attempted: true });
  assert.deepEqual(parseContactMessage('Name: Harshit\nPhone: +91 96919 82400'), { phone: '+919691982400', name: 'Harshit', attempted: true }, 'the card’s own line parses back');
  // An attempt that is not a valid number, and messages that are not attempts at all.
  assert.deepEqual(parseContactMessage('my number is 12345678'), { phone: null, name: null, attempted: true });
  assert.deepEqual(parseContactMessage('what does gold cost'), { phone: null, name: null, attempted: false });
  assert.deepEqual(parseContactMessage('do you serve 110028'), { phone: null, name: null, attempted: false }, 'a pincode is six digits, not an attempt');
});

test('contactLine: the transcript line, with or without a name', () => {
  const labels = { name: 'Name', phone: 'Phone' };
  assert.equal(contactLine(labels, 'Harshit', '+91 96919 82400'), 'Name: Harshit\nPhone: +91 96919 82400');
  assert.equal(contactLine(labels, null, '+91 96919 82400'), 'Phone: +91 96919 82400');
});
