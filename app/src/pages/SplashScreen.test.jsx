// Run: npm test (vitest) from app/
//
// FIN-B08: every authenticated entry sat on the splash for a hard-coded four seconds, and
// the navigation effect only ran when the timer fired, so a session still resolving at that
// moment was sent to /home and bounced to /auth by ProtectedRoute. The splash now waits
// for the shorter timer AND for auth to resolve, and re-evaluates when either changes.
//
// FIN-B02: the splash is also where the site's context (lib/context.js) becomes a route — once,
// to the service page, the services list or pricing — while the context itself stays in
// storage for the booking sheet to pre-fill from.
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const auth = { isAuthenticated: false, loading: true };
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const { default: SplashScreen } = await import('./SplashScreen.jsx');

function mount(state) {
  Object.assign(auth, state);
  const ui = () => (
    <MemoryRouter initialEntries={['/splash']}>
      <Routes>
        <Route path="/splash" element={<SplashScreen />} />
        <Route path="/home" element={<p>home page</p>} />
        <Route path="/auth" element={<p>auth page</p>} />
        <Route path="/services" element={<p>services list</p>} />
        <Route path="/services/:id" element={<p>service page</p>} />
        <Route path="/pricing" element={<p>pricing page</p>} />
      </Routes>
    </MemoryRouter>
  );
  const r = render(ui());
  return { update: (next) => { Object.assign(auth, next); r.rerender(ui()); } };
}

const settle = () => act(() => { vi.advanceTimersByTime(800); });

beforeEach(() => { vi.useFakeTimers(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

test('a resolved session leaves the splash after 800 ms, not 4 s (FIN-B08)', () => {
  mount({ isAuthenticated: true, loading: false });
  act(() => { vi.advanceTimersByTime(799); });
  expect(screen.queryByText('home page')).toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.getByText('home page')).toBeTruthy();
});

test('waits for auth to resolve instead of guessing (FIN-B08)', () => {
  const { update } = mount({ isAuthenticated: false, loading: true });
  settle();
  // The old code sent an unresolved session to /home here, where ProtectedRoute bounced it.
  expect(screen.queryByText('home page')).toBeNull();
  expect(screen.queryByText('auth page')).toBeNull();
  act(() => { update({ isAuthenticated: true, loading: false }); });
  expect(screen.getByText('home page')).toBeTruthy();
});

test('an unauthenticated visitor goes to sign-in once auth has resolved', () => {
  mount({ isAuthenticated: false, loading: false });
  settle();
  expect(screen.getByText('auth page')).toBeTruthy();
});

test('the site’s context routes once — to the service page — and stays for pre-filling (FIN-B02)', () => {
  sessionStorage.setItem('mbm_redirect_context', JSON.stringify({ city: 'gurgaon', locality: 'dlf-phase-3', service: 'cook', serviceSlug: 'cook' }));
  mount({ isAuthenticated: true, loading: false });
  settle();
  expect(screen.getByText('service page')).toBeTruthy();
  expect(JSON.parse(sessionStorage.getItem('mbm_redirect_context'))).toMatchObject({ city: 'gurgaon', locality: 'dlf-phase-3', routed: true });
  cleanup();
  mount({ isAuthenticated: true, loading: false });
  settle();
  expect(screen.getByText('home page')).toBeTruthy();
});

test('a plan lands on pricing, an area alone on the services list, and the old bare string still works', () => {
  sessionStorage.setItem('mbm_redirect_context', JSON.stringify({ plan: 'gold' }));
  mount({ isAuthenticated: true, loading: false });
  settle();
  expect(screen.getByText('pricing page')).toBeTruthy();

  cleanup();
  sessionStorage.setItem('mbm_redirect_context', JSON.stringify({ city: 'noida', locality: 'sector-50' }));
  mount({ isAuthenticated: true, loading: false });
  settle();
  expect(screen.getByText('services list')).toBeTruthy();

  cleanup();
  sessionStorage.setItem('mbm_redirect_context', 'cook');
  mount({ isAuthenticated: true, loading: false });
  settle();
  expect(screen.getByText('service page')).toBeTruthy();
});
