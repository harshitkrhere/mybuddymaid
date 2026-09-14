// Run: npm test (vitest) from app/
//
// FIN-U03: the booking sheet said "Booking Confirmed!" for a row written with status
// 'pending', then redirected to a list that shows it as Pending two seconds later. A request
// is received; a person confirms it. Source-level, like the other copy assertions: the string
// is the defect.
//
// FIN-B02: the sheet opens pre-filled with the area the visitor chose on the site, read from
// the context lib/context.js kept for the session. A render test, because the behaviour is
// the fix: the selects must start on the carried values and be usable straight away.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import source from './ServiceDetailPage.jsx?raw';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'a@b.c' }, profile: null, createBooking: vi.fn() }) }));
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const { default: ServiceDetailPage } = await import('./ServiceDetailPage.jsx');

afterEach(() => { cleanup(); sessionStorage.clear(); });

function openSheet() {
  render(
    <MemoryRouter initialEntries={['/services/cook']}>
      <Routes>
        <Route path="/services/:serviceId" element={<ServiceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Book Now/ }));
  const [city, area] = screen.getAllByRole('combobox');
  return { city, area };
}

test('the booking success sheet reports a received request, not a confirmed booking (FIN-U03)', () => {
  const success = source.match(/className="booking-success"[\s\S]*?<\/div>/);
  expect(success, 'the booking-success block').not.toBeNull();
  expect(success[0]).toContain('Request received');
  expect(success[0]).not.toMatch(/confirmed/i);
});

test('the booking sheet opens pre-filled with the area the visitor chose on the site (FIN-B02)', () => {
  sessionStorage.setItem('mbm_redirect_context', JSON.stringify({ city: 'gurgaon', locality: 'dlf-phase-3', service: 'cook', routed: true }));
  const { city, area } = openSheet();
  expect(city.value).toBe('gurgaon');
  expect(area.value).toBe('dlf-phase-3');
  expect(area.disabled).toBe(false);
});

test('without a context the selects start empty, as before', () => {
  const { city, area } = openSheet();
  expect(city.value).toBe('');
  expect(area.disabled).toBe(true);
});

test('a booking carries the data-layer location and the society, for the placement roll-up', () => {
  expect(source).toContain('city_slug: citySlug');
  expect(source).toContain('locality_slug: localitySlug');
  expect(source).toContain('attribution: readAttribution()');
  expect(source).toMatch(/Society \/ building \(optional\)/);
});
