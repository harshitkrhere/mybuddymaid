// Run: npm test (vitest) from app/
//
// FIN-C07: the sidebar told every user they were on "Premium Plus", a tier that does not
// exist, and showed "Demo User" until the profile loaded. It now shows the plan the account
// actually holds, or a link to pricing, and the email while the name is unknown.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

const auth = { user: null, profile: null, userPlan: null };
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const { default: AppLayout } = await import('./AppLayout.jsx');

function mount(state) {
  Object.assign(auth, { user: null, profile: null, userPlan: null }, state);
  render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="home" element={<p>home</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
afterEach(cleanup);

test('a free user is not told they hold a plan that does not exist (FIN-C07)', () => {
  mount({ user: { email: 'asha@example.test' } });
  expect(screen.queryByText(/premium plus/i)).toBeNull();
  expect(screen.queryByText(/demo user/i)).toBeNull();
  expect(screen.getByRole('link', { name: 'No active plan' }).getAttribute('href')).toBe('/pricing');
  expect(screen.getByText('asha@example.test')).toBeTruthy();
});

test('an active plan is shown by its real name (FIN-C07)', () => {
  mount({ user: { email: 'asha@example.test' }, profile: { full_name: 'Asha' }, userPlan: { plan_name: 'gold' } });
  expect(screen.getByText(/gold plan/i)).toBeTruthy();
  expect(screen.queryByText(/premium plus/i)).toBeNull();
  expect(screen.queryByRole('link', { name: 'No active plan' })).toBeNull();
});
