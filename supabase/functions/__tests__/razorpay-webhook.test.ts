// supabase/functions/__tests__/razorpay-webhook.test.ts
// The three assertions AUDIT/18-REMEDIATION-PLAN.md §0.4 asks for, plus the cases that decide
// whether this function is safe to point Razorpay at:
//
//   the same event replayed 3×          → one plan
//   a tampered signature                → 401, and nothing parsed
//   refund.processed                    → is_active = false
//
// The webhook exists because activation used to depend on the customer's browser staying open
// (FIN-P02). It is also what makes verify-razorpay-payment's fail-closed behaviour safe, so the
// race between the two paths is tested here too.
//
// Run:  npx deno@2 test --no-lock --no-check --allow-env --allow-net supabase/functions/__tests__/

const SUPABASE_URL = 'https://stub.supabase.co';
const WEBHOOK_SECRET = 'stub_webhook_secret';
const KEY_SECRET = 'stub_rzp_key_secret';
const KEY_ID = 'rzp_test_stub';

const BUYER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORDER_ID = 'order_gold_1';
const PAYMENT_ID = 'pay_gold_1';
const GOLD_PAISE = 599900;

Deno.env.set('SUPABASE_URL', SUPABASE_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub-service-role-key');
Deno.env.set('RAZORPAY_WEBHOOK_SECRET', WEBHOOK_SECRET);
Deno.env.set('RAZORPAY_KEY_SECRET', KEY_SECRET);
Deno.env.set('RAZORPAY_KEY_ID', KEY_ID);

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

const userPlans: PlanRow[] = [];
let nextPlanId = 1;
const orders = new Map<string, Record<string, unknown>>();
/** Set true to assert the handler never reached the Razorpay API. */
let orderFetches = 0;

function resetWorld(): void {
  userPlans.length = 0;
  nextPlanId = 1;
  orders.clear();
  orderFetches = 0;
  orders.set(ORDER_ID, {
    id: ORDER_ID,
    amount: GOLD_PAISE,
    notes: { user_id: BUYER_ID, plan_name: 'gold', user_email: 'buyer@example.test' },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function paramOf(url: string, key: string): string | null {
  const value = new URL(url).searchParams.get(key);
  return value ? value.replace(/^eq\./, '') : null;
}

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? 'GET').toUpperCase();

  // A GET behind .maybeSingle() answers with an array; [] is "no rows".
  if (url.startsWith(`${SUPABASE_URL}/rest/v1/user_plans`)) {
    if (method === 'GET') {
      const paymentId = paramOf(url, 'razorpay_payment_id');
      const match = userPlans.find((p) => p.razorpay_payment_id === paymentId);
      return json(match ? [match] : []);
    }

    if (method === 'PATCH') {
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

  const orderMatch = url.match(/^https:\/\/api\.razorpay\.com\/v1\/orders\/(.+)$/);
  if (orderMatch) {
    orderFetches++;
    const order = orders.get(orderMatch[1]);
    return order ? json(order) : json({ error: { description: 'not found' } }, 400);
  }

  throw new Error(`unstubbed fetch to ${method} ${url}`);
};

const { handler } = await import('../razorpay-webhook/handler.ts');

// ─── Helpers ─────────────────────────────────────────────────────────────────────────────────

async function signBody(raw: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build a signed webhook request, exactly as Razorpay would send it. */
async function event(payload: unknown, opts: { signature?: string } = {}): Promise<Request> {
  const raw = JSON.stringify(payload);
  const signature = opts.signature ?? (await signBody(raw, WEBHOOK_SECRET));
  return new Request('https://stub.functions.supabase.co/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_stub_1',
    },
    body: raw,
  });
}

// The payment entity carries no notes: PricingPage passes no notes option to Checkout, so the
// binding has to come from the order. That is the case worth testing, not the convenient one.
const capturedEvent = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        amount: GOLD_PAISE,
        status: 'captured',
        created_at: 1_757_000_000,
        email: 'buyer@example.test',
        contact: '9999999999',
      },
    },
  },
};

const refundEvent = {
  event: 'refund.processed',
  payload: {
    refund: { entity: { id: 'rfnd_1', payment_id: PAYMENT_ID, amount: GOLD_PAISE } },
    payment: { entity: { id: PAYMENT_ID, amount: GOLD_PAISE, amount_refunded: GOLD_PAISE, refund_status: 'full' } },
  },
};

function assertStatus(res: Response, expected: number, note = ''): void {
  if (res.status !== expected) {
    throw new Error(`expected ${expected}, got ${res.status}${note ? ` — ${note}` : ''}`);
  }
}

// ─── Assertions ──────────────────────────────────────────────────────────────────────────────

Deno.test('a tampered signature is rejected before the body is parsed', async () => {
  resetWorld();
  const res = await handler(await event(capturedEvent, { signature: 'deadbeef'.repeat(8) }));
  assertStatus(res, 401);
  if (userPlans.length !== 0) throw new Error('an unsigned event activated a plan');
  if (orderFetches !== 0) throw new Error('the handler called Razorpay before verifying the signature');
});

Deno.test('a body signed with the wrong secret is rejected', async () => {
  resetWorld();
  // The classic misconfiguration: RAZORPAY_KEY_SECRET used where the webhook secret belongs.
  const raw = JSON.stringify(capturedEvent);
  const res = await handler(await event(capturedEvent, { signature: await signBody(raw, KEY_SECRET) }));
  assertStatus(res, 401);
  if (userPlans.length !== 0) throw new Error('an event signed with the wrong secret activated a plan');
});

Deno.test('payment.captured activates the plan named by the order (FIN-P02)', async () => {
  resetWorld();
  const res = await handler(await event(capturedEvent));
  assertStatus(res, 200);

  if (userPlans.length !== 1) throw new Error(`expected one plan, got ${userPlans.length}`);
  const plan = userPlans[0];
  if (plan.user_id !== BUYER_ID) throw new Error(`plan went to ${plan.user_id}`);
  if (plan.plan_name !== 'gold') throw new Error(`granted "${plan.plan_name}", the order says gold`);
  if (plan.replacements_total !== 5) throw new Error('replacements_total does not match gold');
  if (!plan.is_active) throw new Error('the plan was created inactive');
  if (orderFetches !== 1) throw new Error('the handler did not read the binding from the order');
});

Deno.test('replaying the same event three times leaves exactly one plan (FIN-P02)', async () => {
  resetWorld();
  // Razorpay retries a non-2xx for 24 hours, and can deliver the same event more than once
  // regardless. Every delivery must be safe.
  const first = await handler(await event(capturedEvent));
  assertStatus(first, 200);
  const firstPlanId = (await first.json()).plan_id;

  for (let i = 0; i < 2; i++) {
    const again = await handler(await event(capturedEvent));
    assertStatus(again, 200);
    const body = await again.json();
    if (body.plan_id !== firstPlanId) throw new Error('a replay returned a different plan');
    if (body.idempotent !== true) throw new Error('a replay was not reported as idempotent');
  }

  if (userPlans.length !== 1) throw new Error(`three deliveries produced ${userPlans.length} plans`);
  if (userPlans.filter((p) => p.is_active).length !== 1) {
    throw new Error('the replays disturbed which plan is active');
  }
});

Deno.test('the expiry does not move when a retry lands later', async () => {
  resetWorld();
  assertStatus(await handler(await event(capturedEvent)), 200);
  const expiry = userPlans[0].expires_at;

  assertStatus(await handler(await event(capturedEvent)), 200);
  if (userPlans[0].expires_at !== expiry) {
    throw new Error('a retry extended expires_at — the expiry must be anchored to capture time');
  }
});

Deno.test('refund.processed deactivates the plan (FIN-P03)', async () => {
  resetWorld();
  assertStatus(await handler(await event(capturedEvent)), 200);
  if (!userPlans[0].is_active) throw new Error('setup failed: the plan was not active');

  const res = await handler(await event(refundEvent));
  assertStatus(res, 200);
  const body = await res.json();
  if (body.revoked !== true) throw new Error('the refund was not reported as revoking the plan');
  if (userPlans[0].is_active !== false) {
    throw new Error('a refunded customer kept an active plan — this is FIN-P03');
  }
});

Deno.test('a partial refund leaves the plan alone', async () => {
  resetWorld();
  assertStatus(await handler(await event(capturedEvent)), 200);

  const partial = {
    event: 'refund.processed',
    payload: {
      refund: { entity: { id: 'rfnd_2', payment_id: PAYMENT_ID, amount: 100_000 } },
      payment: { entity: { id: PAYMENT_ID, amount: GOLD_PAISE, amount_refunded: 100_000, refund_status: 'partial' } },
    },
  };

  const res = await handler(await event(partial));
  assertStatus(res, 200);
  if (userPlans[0].is_active !== true) {
    throw new Error('a partial refund revoked a whole plan');
  }
});

Deno.test('a refund replayed after revocation stays revoked', async () => {
  resetWorld();
  assertStatus(await handler(await event(capturedEvent)), 200);
  assertStatus(await handler(await event(refundEvent)), 200);
  assertStatus(await handler(await event(refundEvent)), 200);
  if (userPlans[0].is_active !== false) throw new Error('a replayed refund reactivated the plan');
});

Deno.test('a payment.captured retried after a refund does not resurrect the plan', async () => {
  resetWorld();
  assertStatus(await handler(await event(capturedEvent)), 200);
  assertStatus(await handler(await event(refundEvent)), 200);

  // Razorpay can redeliver the capture after the refund has already been processed.
  assertStatus(await handler(await event(capturedEvent)), 200);
  if (userPlans[0].is_active !== false) {
    throw new Error('a redelivered capture handed a refunded customer their plan back');
  }
});

Deno.test('a payment for an order with no plan notes is acknowledged, not retried', async () => {
  resetWorld();
  orders.set('order_unrelated', { id: 'order_unrelated', amount: 100, notes: {} });
  const unrelated = {
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_unrelated', order_id: 'order_unrelated', amount: 100 } } },
  };

  const res = await handler(await event(unrelated));
  // 200, not 5xx: retrying for 24 hours will never make somebody else's payment ours.
  assertStatus(res, 200);
  if ((await res.json()).handled !== false) throw new Error('an unrelated payment was treated as handled');
  if (userPlans.length !== 0) throw new Error('a plan was created for an unrelated payment');
});

Deno.test('an unsubscribed event is acknowledged', async () => {
  resetWorld();
  const res = await handler(await event({ event: 'subscription.charged', payload: {} }));
  assertStatus(res, 200);
  if (userPlans.length !== 0) throw new Error('an unsubscribed event wrote something');
});

Deno.test('payment.failed is recorded and writes nothing', async () => {
  resetWorld();
  const failed = {
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_failed_1',
          order_id: ORDER_ID,
          amount: GOLD_PAISE,
          error_code: 'BAD_REQUEST_ERROR',
          error_reason: 'payment_failed',
        },
      },
    },
  };

  const res = await handler(await event(failed));
  assertStatus(res, 200);
  if (userPlans.length !== 0) throw new Error('a failed payment created a plan');
});
