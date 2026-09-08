// Run: npm test (vitest) from app/
//
// FIN-B05: the purchase and booking forms seeded their phone field with useState(profile?.phone),
// which reads the profile once, on first render. AuthContext deliberately unblocks the app
// before the profile query resolves, so the field was almost always empty and every returning
// user re-typed their number. Both forms now fill from the profile when it arrives, unless the
// user has already typed. One file for both forms because it is one behaviour in two places.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

const auth = {
  user: { id: 'u1', email: 'asha@example.test' },
  profile: null,
  userPlan: null,
  createBooking: vi.fn(),
  purchasePlan: vi.fn(),
  refreshUserPlan: vi.fn(),
};
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const { default: PricingPage } = await import('./PricingPage.jsx');
const { default: ServiceDetailPage } = await import('./ServiceDetailPage.jsx');

afterEach(() => { cleanup(); auth.profile = null; });

/** The profile "arrives" the way it does in the app: a later render with the same hook. */
function purchaseForm() {
  const ui = () => <PricingPage />;
  const r = render(ui());
  return {
    input: () => screen.getByPlaceholderText('+91 mobile number'),
    profileArrives: (phone) => { auth.profile = { phone }; r.rerender(ui()); },
  };
}

function bookingForm() {
  const ui = () => (
    <MemoryRouter initialEntries={['/services/cook']}>
      <Routes><Route path="/services/:serviceId" element={<ServiceDetailPage />} /></Routes>
    </MemoryRouter>
  );
  const r = render(ui());
  fireEvent.click(screen.getByRole('button', { name: /book now/i }));
  return {
    input: () => screen.getByPlaceholderText('+91 XXXXX XXXXX'),
    profileArrives: (phone) => { auth.profile = { phone }; r.rerender(ui()); },
  };
}

test('the purchase form fills the phone once the profile resolves (FIN-B05)', () => {
  const form = purchaseForm();
  expect(form.input().value).toBe('');
  form.profileArrives('9876543210');
  expect(form.input().value).toBe('9876543210');
});

test('the booking form fills the phone once the profile resolves (FIN-B05)', () => {
  const form = bookingForm();
  expect(form.input().value).toBe('');
  form.profileArrives('9876543210');
  expect(form.input().value).toBe('9876543210');
});

test('a number the user has already typed is not overwritten', () => {
  const form = bookingForm();
  fireEvent.change(form.input(), { target: { value: '111' } });
  form.profileArrives('9876543210');
  expect(form.input().value).toBe('111');
});
