// scripts/growth/ga4-register-dimensions.ts — a one-time step: registers the site's event
// parameters (city, zone, locality, service, pincode, source) as event-scoped custom
// dimensions so GA4 reports can break the CTA events down by them. Idempotent: existing
// dimensions are left alone. Needs the service account to be an Editor on the property for
// this one run; downgrade it to Viewer afterwards. Data appears 24-48 hours later and is
// not retroactive, so note the run date in docs/growth/README.md.
//
//   $env:GSC_SERVICE_ACCOUNT_JSON = 'C:\keys\mbm-growth.json'
//   $env:GA4_PROPERTY_ID = '123456789'
//   npm run growth:ga4:register
import { accessToken, bearer, SCOPES } from '../../lib/growth/google-auth';
import { GA4_ADMIN_API, missingDimensions, registeredDimensionNames } from '../../lib/growth/ga4';
import { fail, fetchImpl, readServiceAccount } from './_env';

async function main() {
  const propertyId = process.env.GA4_PROPERTY_ID ?? fail('Set GA4_PROPERTY_ID.');
  const token = await accessToken(readServiceAccount(), [SCOPES.ga4Edit]);
  const base = `${GA4_ADMIN_API}/properties/${propertyId}/customDimensions`;
  const listRes = await fetchImpl(`${base}?pageSize=200`, { headers: bearer(token) });
  if (!listRes.ok) fail(`list failed: ${listRes.status} ${await listRes.text()}`);
  const registered = registeredDimensionNames(await listRes.json());
  const missing = missingDimensions(registered);
  console.log(`registered: ${registered.join(', ') || '(none)'}`);
  if (!missing.length) {
    console.log('nothing to register');
    return;
  }
  for (const d of missing) {
    const res = await fetchImpl(base, { method: 'POST', headers: bearer(token), body: JSON.stringify(d) });
    if (!res.ok) fail(`create ${d.parameterName} failed: ${res.status} ${await res.text()}`);
    console.log(`registered ${d.parameterName} (${d.displayName})`);
  }
  console.log(`\nDone ${new Date().toISOString().slice(0, 10)}. Reports can break CTA events down by these from 24-48 h after now; record this date in docs/growth/README.md.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
