// lib/assistant/ref.ts — a short, quotable reference for a conversation, e.g. "MBM-7Q4K2".
//
// Derived from the conversation id, so it is stable with no database round trip and the same
// id always yields the same reference. It is what the customer quotes on WhatsApp or the phone
// so the team can find the transcript; it is not a secret and grants nothing.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L: read aloud safely

export function refFor(conversationId: string): string {
  // FNV-1a over the id, then five base-31 symbols.
  let h = 0x811c9dc5;
  for (let i = 0; i < conversationId.length; i++) h = Math.imul(h ^ conversationId.charCodeAt(i), 0x01000193) >>> 0;
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length);
    if (h === 0) h = (0x9e3779b9 ^ i) >>> 0;
  }
  return `MBM-${out}`;
}
