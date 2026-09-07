// supabase/functions/__tests__/send-email.test.ts
// Tier 1 of AUDIT/13-TESTING.md — the identity half. Three assertions, all for FIN-S01:
//
//   send-package-email rejects an unauthenticated caller   → 401
//   send-booking-email rejects the anon key                → 401
//   the recipient is always token.user.email, never body.user_email
//
// These run entirely offline. Supabase Auth, PostgREST and Resend are all stubbed at the
// global fetch boundary, so nothing here can send a real email or touch a real row — which is
// the point: the defect being tested is "this function will email anyone", and verifying that
// by actually emailing someone is not an option.
//
// Run:  npx deno@2 test --no-lock --allow-env --allow-net supabase/functions/__tests__/
//
// The stub must be installed before the handler modules are imported, because
// send-booking-email builds its Supabase client at module scope.

const SUPABASE_URL = 'https://stub.supabase.co';
const TOKEN_OWNER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'owner@example.test' };
const VICTIM = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'victim@example.test' };
const VALID_TOKEN = 'valid-session-token';
const ANON_KEY = 'anon-key-from-the-public-bundle';

Deno.env.set('SUPABASE_URL', SUPABASE_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub-service-role-key');
Deno.env.set('RESEND_API_KEY', 'stub-resend-key');

/** Every address Resend was asked to deliver to during a test. */
const sentTo: string[] = [];
/** Every subject line Resend was handed, which is how the plan tier shows up. */
const sentSubjects: string[] = [];
/** Every user_id written to email_logs during a test. */
const loggedUserIds: unknown[] = [];

// Installed for the whole run and never restored. supabase-js resolves the global fetch at
// call time, so putting the real one back would send the auth lookups to the network — where
// they would fail, and every 401 assertion below would pass for the wrong reason.
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  // ── Supabase Auth: only VALID_TOKEN resolves to a user. The anon key does not. ──
  if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) {
    const bearer = (headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (bearer !== VALID_TOKEN) {
      return json({ message: 'invalid claim: missing sub claim' }, 401);
    }
    return json({ id: TOKEN_OWNER.id, email: TOKEN_OWNER.email, aud: 'authenticated' });
  }

  // ── PostgREST ──
  if (url.startsWith(`${SUPABASE_URL}/rest/v1/user_plans`)) {
    // The handler must have scoped this to the token owner, never to the body's user_id.
    if (!url.includes(`user_id=eq.${TOKEN_OWNER.id}`)) {
      return json({ message: `plan lookup was not scoped to the token owner: ${url}` }, 500);
    }
    return json({
      plan_name: 'gold',
      amount_paid: 599900,
      razorpay_payment_id: 'pay_stub123',
      replacements_total: 5,
      purchased_at: '2026-09-01T00:00:00.000Z',
      expires_at: '2027-09-01T00:00:00.000Z',
    });
  }

  if (url.startsWith(`${SUPABASE_URL}/rest/v1/profiles`)) {
    return json({ full_name: 'Owner Name' });
  }

  if (url.startsWith(`${SUPABASE_URL}/rest/v1/email_logs`)) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    loggedUserIds.push(Array.isArray(body) ? body[0]?.user_id : body?.user_id);
    return new Response(null, { status: 201 });
  }

  // ── Resend ──
  if (url.startsWith('https://api.resend.com/emails')) {
    const body = JSON.parse(String(init?.body ?? '{}'));
    sentTo.push(...(body.to ?? []));
    sentSubjects.push(body.subject ?? '');
    return json({ id: 'resend-stub-id' });
  }

  throw new Error(`unstubbed fetch to ${url}`);
};

const { handler: sendPackageEmail } = await import('../send-package-email/handler.ts');
const { handler: sendBookingEmail } = await import('../send-booking-email/handler.ts');

function reset(): void {
  sentTo.length = 0;
  sentSubjects.length = 0;
  loggedUserIds.length = 0;
}

function post(body: unknown, authorization?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authorization) headers.Authorization = authorization;
  return new Request('https://stub.functions.supabase.co/', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** What the SPA sends, but with someone else's identity in every field it used to be believed on. */
const forgedPackageBody = {
  user_id: VICTIM.id,
  user_name: 'Victim',
  user_email: VICTIM.email,
  plan_name: 'diamond',
  amount_paid: 699900,
  razorpay_payment_id: 'pay_forged',
  purchased_at: '2026-01-01T00:00:00.000Z',
  replacements_total: 10,
  expires_at: '2099-01-01T00:00:00.000Z',
};

const forgedBookingBody = {
  user_id: VICTIM.id,
  user_name: 'Victim',
  user_email: VICTIM.email,
  service_type: 'cook',
  city: 'Gurgaon',
  notes: 'forged',
  booking_id: 'bk_forged',
  created_at: '2026-09-08T00:00:00.000Z',
};

Deno.test('send-package-email rejects a request with no Authorization header (FIN-S01)', async () => {
  reset();
  const res = await sendPackageEmail(post(forgedPackageBody));
  assertStatus(res, 401);
  assertNothingSent();
});

Deno.test('send-package-email rejects the public anon key (FIN-S01)', async () => {
  reset();
  const res = await sendPackageEmail(post(forgedPackageBody, `Bearer ${ANON_KEY}`));
  assertStatus(res, 401);
  assertNothingSent();
});

Deno.test('send-booking-email rejects a request with no Authorization header (FIN-S01)', async () => {
  reset();
  const res = await sendBookingEmail(post(forgedBookingBody));
  assertStatus(res, 401);
  assertNothingSent();
});

Deno.test('send-booking-email rejects the public anon key (FIN-S01)', async () => {
  reset();
  const res = await sendBookingEmail(post(forgedBookingBody, `Bearer ${ANON_KEY}`));
  assertStatus(res, 401);
  assertNothingSent();
});

Deno.test('send-package-email mails the token owner, not the body (FIN-S01, FIN-S08)', async () => {
  reset();
  const res = await sendPackageEmail(post(forgedPackageBody, `Bearer ${VALID_TOKEN}`));
  assertStatus(res, 200);
  assertRecipientIsOwner();
  assertAttributionIsOwner();
});

Deno.test('send-booking-email mails the token owner, not the body (FIN-S01, FIN-S08)', async () => {
  reset();
  const res = await sendBookingEmail(post(forgedBookingBody, `Bearer ${VALID_TOKEN}`));
  assertStatus(res, 200);
  assertRecipientIsOwner();
  assertAttributionIsOwner();
});

Deno.test('send-package-email describes the plan the database holds, not the one the body claims', async () => {
  reset();
  // The forged body asks for diamond — ₹6,999, 10 replacements, expiring in 2099. The row the
  // database actually holds for this user is gold. Without this, a customer who bought Silver
  // could mail themselves a genuine-looking Diamond confirmation to wave at support.
  const res = await sendPackageEmail(post(forgedPackageBody, `Bearer ${VALID_TOKEN}`));
  assertStatus(res, 200);
  if (sentSubjects.length !== 1) throw new Error(`expected one send, got ${sentSubjects.length}`);
  if (!sentSubjects[0].startsWith('Gold Plan Confirmed')) {
    throw new Error(`subject was "${sentSubjects[0]}" — expected the Gold subject, from the database row`);
  }
});

function assertStatus(res: Response, expected: number): void {
  if (res.status !== expected) {
    throw new Error(`expected ${expected}, got ${res.status}`);
  }
}

function assertNothingSent(): void {
  if (sentTo.length > 0) {
    throw new Error(`an unauthenticated call still sent mail to ${sentTo.join(', ')}`);
  }
}

function assertRecipientIsOwner(): void {
  if (sentTo.length !== 1) {
    throw new Error(`expected exactly one send, got ${sentTo.length}`);
  }
  if (sentTo[0] !== TOKEN_OWNER.email) {
    throw new Error(`mail went to ${sentTo[0]} — it must go to the token owner, ${TOKEN_OWNER.email}`);
  }
}

function assertAttributionIsOwner(): void {
  for (const id of loggedUserIds) {
    if (id !== TOKEN_OWNER.id) {
      throw new Error(`email_logs was attributed to ${id}, not the token owner ${TOKEN_OWNER.id}`);
    }
  }
}
