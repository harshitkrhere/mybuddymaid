// supabase/functions/send-booking-email/index.ts
// Deployed entry point. The request handler lives in handler.ts so the Tier-1 suite in
// supabase/functions/__tests__ can drive it directly — importing a module that calls
// Deno.serve() at the top level binds a port, and two such imports in one test process
// collide on it.

import { handler } from './handler.ts';

Deno.serve(handler);
