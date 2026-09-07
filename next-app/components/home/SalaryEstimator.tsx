'use client';
// components/home/SalaryEstimator.tsx — the landing page's salary estimator. The only client
// component on the home page. It receives a small pre-computed table (6 services × 3 city
// tiers, from data/seo/services.ts and the cities' pricingTier) rather than importing the
// data layer, so nothing beyond those numbers crosses the client boundary. The server render
// already shows the first service and tier, so the card is complete without JavaScript.
import { useState } from 'react';

export type EstimatorTierKey = 'metro-premium' | 'metro' | 'tier-2';

export interface EstimatorRow {
  slug: string;
  name: string;
  bands: Record<EstimatorTierKey, { from: number; to: number }>;
}

export interface EstimatorTier {
  key: EstimatorTierKey;
  /** The cities in this tier, e.g. "Delhi, Noida, Pune, Bangalore". */
  label: string;
}

// Same formatter as lib/seo-engine/compose.ts `inr`, kept local so the client bundle does
// not pull the compose module in. en-IN grouping is identical on the server and in browsers.
const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;

export function SalaryEstimator({ rows, tiers, appHrefBase }: { rows: EstimatorRow[]; tiers: EstimatorTier[]; appHrefBase: string }) {
  const [slug, setSlug] = useState(rows[0]?.slug ?? '');
  const [tier, setTier] = useState<EstimatorTierKey>(tiers[0]?.key ?? 'metro');
  const row = rows.find((r) => r.slug === slug) ?? rows[0];
  const band = row?.bands[tier];
  const tierLabel = tiers.find((t) => t.key === tier)?.label ?? '';
  if (!row || !band) return null;

  return (
    <div className="home-estimator" id="salary-estimator">
      <div className="home-estimator__head">
        <h3>Salary estimator</h3>
        <p>The monthly salary band for a service in your city. It is an indicative starting point, not a quote — the salary is agreed at interview and paid directly to the helper.</p>
      </div>
      <div className="home-estimator__grid">
        <label>
          <span>Service</span>
          <select className="home-estimator__select" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {rows.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>City</span>
          <select className="home-estimator__select" value={tier} onChange={(e) => setTier(e.target.value as EstimatorTierKey)}>
            {tiers.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="home-estimator__result" aria-live="polite">
        <span className="home-estimator__label">Estimated monthly salary</span>
        <strong className="home-estimator__amount">
          {inr(band.from)} – {inr(band.to)} <small>/ month</small>
        </strong>
        <span className="home-estimator__note">
          {row.name} · {tierLabel}
        </span>
      </div>
      <div className="home-estimator__actions">
        <a href={`/services/${row.slug}`} className="home-estimator__more">
          {row.name} details
        </a>
        <a
          className="btn btn-primary"
          href={`${appHrefBase}${encodeURIComponent(row.slug)}`}
          data-mbm-track="app_click"
          data-mbm-city="(none)"
          data-mbm-zone="(none)"
          data-mbm-locality="(none)"
          data-mbm-service={row.slug}
          data-mbm-pincode="(none)"
        >
          Book Now
        </a>
      </div>
    </div>
  );
}
