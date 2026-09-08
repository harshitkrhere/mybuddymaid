// supabase/functions/__tests__/verify-payment.test.ts
// Tier 1 of AUDIT/13-TESTING.md — the money path. Eight assertions:
//
//   no Authorization header                              → 401
//   the public anon key                                  → 401
//   a tampered signature                                 → 403
//   a body claiming a plan the order does not name       → the ORDER's plan is granted (FIN-P01)
//   an amount mismatch                                   → 403
//   the Razorpay lookup errors                           → 503 and NO row written (FIN-S03)
//   the same payment replayed                            → exactly one plan (FIN-S02)
//   another user's payment_id                            → 409
//
// Everything is stubbed at the global fetch boundary: Supabase Auth, PostgREST and the Razorpay
// API. No real charge, no real row, no Razorpay test-mode round trip. The PostgREST stub keeps a
// real in-memory user_plans table with the two unique indexes from migration 20260908051500
// enforced, so the idempotency assertions exercise the same 23505 path production will.
//
// Run:  npx deno@2 test --no-lock --no-check --allow-env --allow-net supabase/functions/__tests__/

const SUPABASE_URL = 'https://stub.supabase.co';
const KEY_SECRET = 'stub_rzp_key_secret';
const KEY_ID = 'rzp_test_stub';

const BUYER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'buyer@example.test' };
const OTHER = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'other@example.test' };
const VALID_TOKEN = 'valid-session-token';
const OTHER_TOKEN = 'other-session-token';
const ANON_KEY = 'anon-key-from-the-public-bundle';

const ORDER_ID = 'order_gold_1';
const PAYMENT_ID = 'pay_gold_1';
const GOLD_PAISE = 599900;
const DIAMOND_PAISE = 699900;

Deno.env.set('SUPABASE_URL', SUPABASE_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub-service-role-key');
Deno.env.set('RAZORPAY_KEY_SECRET', KEY_SECRET);
Deno.env.set('RAZORPAY_KEY_ID', KEY_ID);

// ─── The stubbed world ───────────────────────────────────────────────────────────────────────

interface PlanRow {
  id: string;
  user_id: string;
  plan_name: string;
  amount_paid: number;
  razorpay_payment_id: string | null;
  replacements_total: number;
  replacements_used: number;
  expires_at: string;
  is_active: boolean;
  email: string;
  phone: string;
}

/** Stands in for the user_plans table, with both partial unique indexes enforced. */
const userPlans: PlanRow[] = [];
let nextPlanId = 1;

/** Razorpay orders and payments the stub knows about, keyed by id. */
const orders = new Map<string, Record<string, unknown>>();
const payments = new Map<string, Record<string, unknown>>();
/** Paths the stub should answer with a 500, to simulate a gateway outage. */
const razorpayOutage = new Set<string>();

function resetWorld(): void {
  userPlans.length = 0;
  nextPlanId = 1;
  orders.clear();
  payments.clear();
  razorpayOutage.clear();

  orders.set(ORDER_ID, {
    id: ORDER_ID,
    amount: GOLD_PAISE,
    currency: 'INR',
    notes: { user_id: BUYER.id, plan_name: 'gold', user_email: BUYER.email },
  });
  payments.set(PAYMENT_ID, {
    id: PAYMENT_ID,
    order_id: ORDER_ID,
    amount: GOLD_PAISE,
    status: 'captured',
    amount_refunded: 0,
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// A GET behind .maybeSingle() must answer with an ARRAY, which is what PostgREST sends and what
// postgrest-js collapses: [] becomes data null, [row] becomes the row. Answering a GET with a
// 406/PGRST116 instead surfaces as an error — postgrest-js only swallows that for .single().

function paramOf(url: string, key: string): string | null {
  const value = new URL(url).searchParams.get(key);
  return value ? value.replace(/^eq\./, '') : null;
}

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

  // ── Supabase Auth ──
  if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) {
    const bearer = (headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (bearer === VALID_TOKEN) return json({ id: BUYER.id, email: BUYER.email, aud: 'authenticated' });
    if (bearer === OTHER_TOKEN) return json({ id: OTHER.id, email: OTHER.email, aud: 'authenticated' });
    return json({ message: 'invalid claim: missing sub claim' }, 401);
  }

  // ── PostgREST: user_plans ──
  if (url.startsWith(`${SUPABASE_URL}/rest/v1/user_plans`)) {
    if (method === 'GET') {
      const paymentId = paramOf(url, 'razorpay_payment_id');
      const match = userPlans.find((p) => p.razorpay_payment_id === paymentId);
      return json(match ? [match] : []);
    }

    if (method === 'PATCH') {
      // The only PATCH either function issues is the deactivate.
      const userId = paramOf(url, 'user_id');
      const planId = paramOf(url, 'id');
      for (const row of userPlans) {
        if ((userId && row.user_id === userId && row.is_active) || (planId && row.id === planId)) {
          Object.assign(row, JSON.parse(String(init?.body ?? '{}')));
        }
      }
      return new Response(null, { status: 204 });
    }

    if (method === 'POST') {
      const incoming = JSON.parse(String(init?.body ?? '{}')) as PlanRow;

      // uq_user_plans_rzp_payment
      if (
        incoming.razorpay_payment_id &&
        userPlans.some((p) => p.razorpay_payment_id === incoming.razorpay_payment_id)
      ) {
        return json(
          {
            code: '23505',
            details: `Key (razorpay_payment_id)=(${incoming.razorpay_payment_id}) already exists.`,
            hint: null,
            message: 'duplicate key value violates unique constraint "uq_user_plans_rzp_payment"',
          },
          409,
        );
      }

      // uq_user_plans_one_active
      if (incoming.is_active && userPlans.some((p) => p.user_id === incoming.user_id && p.is_active)) {
        return json(
          {
            code: '23505',
            details: `Key (user_id)=(${incoming.user_id}) already exists.`,
            hint: null,
            message: 'duplicate key value violates unique constraint "uq_user_plans_one_active"',
          },
          409,
        );
      }

      const row: PlanRow = { ...incoming, id: `plan_${nextPlanId++}` };
      userPlans.push(row);
      return json(row, 201);
    }
  }

  // ── Razorpay ──
  if (url.startsWith('https://api.razorpay.com/v1/')) {
    const path = url.replace('https://api.razorpay.com/v1', '');
    if (razorpayOutage.has(path)) return json({ error: { description: 'server error' } }, 500);

    const orderMatch = path.match(/^\/orders\/(.+)$/);
    if (orderMatch) {
      const order = orders.get(orderMatch[1]);
      return order ? json(order) : json({ error: { description: 'not found' } }, 400);
    }

    const paymentMatch = path.match(/^\/payments\/(.+)$/);
    if (paymentMatch) {
      const payment = payments.get(paymentMatch[1]);
      return payment ? json(payment) : json({ error: { description: 'not found' } }, 400);
    }
  }

  throw new Error(`unstubbed fetch to ${method} ${url}`);
};

const { handler } = await import('../verify-razorpay-payment/handler.ts');

// ─── Helpers ─────────────────────────────────────────────────────────────────────────────────

async function sign(orderId: string, paymentId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(KEY_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${orderId}|${paymentId}`));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface VerifyBody {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  plan_name?: string;
}

function post(body: VerifyBody, authorization?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authorization) headers.Authorization = authorization;
  return new Request('https://stub.functions.supabase.co/', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function validBody(overrides: VerifyBody = {}): Promise<VerifyBody> {
  return {
    razorpay_order_id: ORDER_ID,
    razorpay_payment_id: PAYMENT_ID,
    razorpay_signature: await sign(ORDER_ID, PAYMENT_ID),
    plan_name: 'gold',
    ...overrides,
  };
}

function assertStatus(res: Response, expected: number, note = ''): void {
  if (res.status !== expected) {
    throw new Error(`expected ${expected}, got ${res.status}${note ? ` — ${note}` : ''}`);
  }
}

function activePlansFor(userId: string): PlanRow[] {
  return userPlans.filter((p) => p.user_id === userId && p.is_active);
}

// ─── Assertions ──────────────────────────────────────────────────────────────────────────────

Deno.test('rejects a request with no Authorization header', async () => {
  resetWorld();
  assertStatus(await handler(post(await validBody())), 401);
  if (userPlans.length !== 0) throw new Error('a plan was written for an unauthenticated caller');
});

Deno.test('rejects the public anon key', async () => {
  resetWorld();
  assertStatus(await handler(post(await validBody(), `Bearer ${ANON_KEY}`)), 401);
  if (userPlans.length !== 0) throw new Error('a plan was written for an anon-key caller');
});

Deno.test('rejects a tampered signature', async () => {
  resetWorld();
  const body = await validBody({ razorpay_signature: 'deadbeef'.repeat(8) });
  assertStatus(await handler(post(body, `Bearer ${VALID_TOKEN}`)), 403);
  if (userPlans.length !== 0) throw new Error('a plan was written on a bad signature');
});

Deno.test('a body claiming a different plan gets the order\'s plan, not the body\'s (FIN-P01)', async () => {
  resetWorld();
  // The order says gold, ₹5,999. The body asks for diamond, ₹6,999 — 18 months and 10
  // replacements instead of 12 and 5. The signature is genuine, because the signature covers
  // only order_id|payment_id and binds no plan at all: this is the whole of FIN-P01.
  const res = await handler(post(await validBody({ plan_name: 'diamond' }), `Bearer ${VALID_TOKEN}`));
  assertStatus(res, 200);

  if (userPlans.length !== 1) throw new Error(`expected one plan, got ${userPlans.length}`);
  const granted = userPlans[0];
  if (granted.plan_name !== 'gold') {
    throw new Error(`granted "${granted.plan_name}" — the order says gold, and the order is authoritative`);
  }
  if (granted.amount_paid !== GOLD_PAISE) {
    throw new Error(`amount_paid ${granted.amount_paid}, expected ${GOLD_PAISE}`);
  }
  if (granted.replacements_total !== 5) {
    throw new Error(`replacements_total ${granted.replacements_total}, expected gold's 5`);
  }
});

Deno.test('rejects an order that belongs to another account (FIN-P01)', async () => {
  resetWorld();
  // Same genuine signature, presented by a different signed-in user.
  const res = await handler(post(await validBody(), `Bearer ${OTHER_TOKEN}`));
  assertStatus(res, 403);
  if (userPlans.length !== 0) throw new Error('a plan was written for the wrong account');
});

Deno.test('rejects an amount mismatch', async () => {
  resetWorld();
  // The order names gold but was created for the wrong number of paise.
  orders.set(ORDER_ID, { ...orders.get(ORDER_ID)!, amount: DIAMOND_PAISE });
  const res = await handler(post(await validBody(), `Bearer ${VALID_TOKEN}`));
  assertStatus(res, 403);
  if (userPlans.length !== 0) throw new Error('a plan was written on an amount mismatch');
});

Deno.test('rejects a payment whose amount does not match the plan', async () => {
  resetWorld();
  payments.set(PAYMENT_ID, { ...payments.get(PAYMENT_ID)!, amount: 100 });
  assertStatus(await handler(post(await validBody(), `Bearer ${VALID_TOKEN}`)), 403);
  if (userPlans.length !== 0) throw new Error('a plan was written on a payment amount mismatch');
});

Deno.test('rejects a payment that is not captured or authorized', async () => {
  resetWorld();
  payments.set(PAYMENT_ID, { ...payments.get(PAYMENT_ID)!, status: 'failed' });
  assertStatus(await handler(post(await validBody(), `Bearer ${VALID_TOKEN}`)), 402);
  if (userPlans.length !== 0) throw new Error('a plan was written on a failed payment');
});

Deno.test('rejects a payment that has already been refunded (FIN-P03)', async () => {
  resetWorld();
  // Razorpay still reports status "captured" on a refunded payment; only amount_refunded moves.
  payments.set(PAYMENT_ID, { ...payments.get(PAYMENT_ID)!, amount_refunded: GOLD_PAISE });
  assertStatus(await handler(post(await validBody(), `Bearer ${VALID_TOKEN}`)), 403);
  if (userPlans.length !== 0) throw new Error('a refunded payment was granted a plan');
});

Deno.test('FAILS CLOSED when the Razorpay payment lookup errors (FIN-S03)', async () => {
  resetWorld();
  razorpayOutage.add(`/payments/${PAYMENT_ID}`);
  const res = await handler(post(await validBody(), `Bearer ${VALID_TOKEN}`));
  assertStatus(res, 503, 'an unverifiable payment must not activate a plan');
  if (userPlans.length !== 0) {
    throw new Error('a plan was activated while the gateway was unreachable — this is FIN-S03');
  }
});

Deno.test('FAILS CLOSED when the Razorpay order lookup errors (FIN-S03)', async () => {
  resetWorld();
  razorpayOutage.add(`/orders/${ORDER_ID}`);
  const res = await handler(post(await validBody(), `Bearer ${VALID_TOKEN}`));
  assertStatus(res, 503);
  if (userPlans.length !== 0) throw new Error('a plan was activated with no verifiable order');
});

Deno.test('replaying the same payment creates exactly one plan (FIN-S02)', async () => {
  resetWorld();
  const body = await validBody();

  const first = await handler(post(body, `Bearer ${VALID_TOKEN}`));
  assertStatus(first, 200);
  const firstPlan = (await first.json()).plan;

  // Eleven months later, the same receipt is posted again.
  const second = await handler(post(body, `Bearer ${VALID_TOKEN}`));
  assertStatus(second, 200);
  const secondBody = await second.json();

  if (userPlans.length !== 1) {
    throw new Error(`replay produced ${userPlans.length} plans — one payment must buy one plan`);
  }
  if (secondBody.plan.id !== firstPlan.id) {
    throw new Error('the replay returned a different plan than the original');
  }
  if (secondBody.plan.expires_at !== firstPlan.expires_at) {
    throw new Error('the replay extended expires_at — this is the FIN-S02 renewal-for-free bug');
  }
  if (activePlansFor(BUYER.id).length !== 1) {
    throw new Error('the replay left the buyer with the wrong number of active plans');
  }
});

Deno.test("another user's payment_id is refused (FIN-S02)", async () => {
  resetWorld();
  // The buyer redeems their payment...
  assertStatus(await handler(post(await validBody(), `Bearer ${VALID_TOKEN}`)), 200);

  // ...and someone else presents the same receipt. They hold a valid signature only if they
  // captured it, but the point is that holding it must not be enough.
  const res = await handler(post(await validBody(), `Bearer ${OTHER_TOKEN}`));
  assertStatus(res, 409);
  if (userPlans.length !== 1) throw new Error('a second plan was created from one payment');
  if (activePlansFor(OTHER.id).length !== 0) throw new Error('the other account received a plan');
});
